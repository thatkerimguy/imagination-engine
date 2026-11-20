// The hybrid pacing engine: a freely scrollable stream, gated at beat-stop blocks by a quiet
// tap-to-continue cue so dramatic beats (a throw, a breach) land before the prose moves on.
import type { Block, ModuleBlock } from '@kn/core';
import type { QualityTier } from '@kn/core/renderer';
import { h } from '../dom.ts';
import type { ModuleHost } from '../runtime/module-host.ts';
import { segmentEnds, segmentOf } from './segments.ts';

const GATE_FALLBACK_MS = 12000;

export interface PacerOptions {
  blocks: readonly Block[];
  elements: readonly HTMLElement[];
  tier: QualityTier;
  createHost(block: ModuleBlock, el: HTMLElement, tier: QualityTier): ModuleHost;
  /** Resume here: earlier segments are revealed and earlier spectacles shown in calm form. */
  restoreIndex: number | null;
  onPosition(blockId: string): void;
  onFinished(): void;
  onLastSegment(): void;
}

export class Pacer {
  private readonly ends: number[];
  private revealed = -1;
  private readonly hosts = new Map<number, ModuleHost>();
  private readonly triggered = new Set<number>();
  private cue: HTMLElement | null = null;
  private readonly observers: IntersectionObserver[] = [];
  private readonly abort = new AbortController();

  constructor(private readonly o: PacerOptions) {
    this.ends = segmentEnds(o.blocks);
    o.elements.forEach((el) => (el.hidden = true));
    const io = (
      cb: (i: number, el: HTMLElement) => void,
      init: IntersectionObserverInit,
    ): IntersectionObserver => {
      const obs = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          obs.unobserve(e.target);
          const el = e.target as HTMLElement;
          cb(o.elements.indexOf(el), el);
        }
      }, init);
      this.observers.push(obs);
      return obs;
    };
    this.reveal = io((_, el) => el.classList.add('is-in'), { threshold: 0.12 });
    this.near = io((i) => void this.hostFor(i, o.tier)?.mount(), { rootMargin: '80% 0px 80% 0px' });
    this.visible = io((i) => this.fire(i), { rootMargin: '0px 0px -22% 0px', threshold: 0.2 });
  }

  private readonly reveal: IntersectionObserver;
  private readonly near: IntersectionObserver;
  private readonly visible: IntersectionObserver;

  async start(): Promise<void> {
    const { restoreIndex, blocks } = this.o;
    const target = restoreIndex === null ? 0 : segmentOf(this.ends, restoreIndex);
    for (let s = 0; s <= target; s++) this.revealSegment(s, false);
    if (restoreIndex !== null) {
      const el = this.o.elements[restoreIndex];
      el?.scrollIntoView({ block: 'start' });
      // Calm replays of what the reader already saw, so ambience and context are restored.
      const seen = blocks
        .slice(0, restoreIndex)
        .flatMap((b, i) => (b.kind === 'module' ? [i] : []));
      seen.forEach((i) => this.triggered.add(i));
      for (let i = 0; i < restoreIndex; i++) this.o.elements[i]!.classList.add('is-in');
      for (const i of seen) {
        await this.hostFor(i, 'reduced')?.trigger();
        if (this.abort.signal.aborted) return;
      }
    }
    addEventListener('scroll', this.onScroll, { passive: true, signal: this.abort.signal });
    addEventListener(
      'keydown',
      (e) => (e.key === 'Enter' || e.key === 'ArrowRight') && this.cue?.click(),
      {
        signal: this.abort.signal,
      },
    );
  }

  private revealSegment(s: number, scroll: boolean): void {
    if (s <= this.revealed || s >= this.ends.length) return;
    const from = this.ends[s - 1] === undefined ? 0 : this.ends[s - 1]! + 1;
    for (let i = from; i <= this.ends[s]!; i++) {
      const el = this.o.elements[i]!;
      el.hidden = false;
      if (this.o.tier === 'reduced') el.classList.add('is-in');
      else this.reveal.observe(el);
      if (this.o.blocks[i]!.kind === 'module') {
        this.near.observe(el);
        this.visible.observe(el);
      }
    }
    this.revealed = s;
    if (scroll) {
      this.o.elements[from]?.scrollIntoView({
        behavior: this.o.tier === 'reduced' ? 'auto' : 'smooth',
        block: 'center',
      });
    }
    const gate = this.ends[s]!;
    if (s === this.ends.length - 1) return this.o.onLastSegment();
    if (this.o.blocks[gate]!.kind !== 'module') this.showCue(gate);
  }

  private fire(i: number): void {
    if (this.triggered.has(i)) return;
    this.triggered.add(i);
    const done = this.hostFor(i, this.o.tier)?.trigger() ?? Promise.resolve();
    if (this.ends[this.revealed] === i && this.revealed < this.ends.length - 1) {
      const fallback = new Promise((r) => setTimeout(r, GATE_FALLBACK_MS));
      void Promise.race([done, fallback]).then(() => this.showCue(i));
    }
  }

  private hostFor(i: number, tier: QualityTier): ModuleHost | null {
    const block = this.o.blocks[i];
    if (block?.kind !== 'module') return null;
    let host = this.hosts.get(i);
    if (!host) {
      host = this.o.createHost(block, this.o.elements[i]!, tier);
      this.hosts.set(i, host);
    }
    return host;
  }

  private showCue(gate: number): void {
    if (this.abort.signal.aborted || this.cue || this.ends[this.revealed] !== gate) return;
    const cue = h(
      'button',
      { class: 'kn-continue', type: 'button', 'aria-label': 'Continue reading' },
      h('span', {}, 'Tap to continue'),
      h('span', { class: 'kn-continue-chevron', 'aria-hidden': 'true' }, '⌄'),
    );
    cue.addEventListener('click', () => {
      cue.remove();
      this.cue = null;
      this.revealSegment(this.revealed + 1, true);
    });
    this.o.elements[gate]!.after(cue);
    this.cue = cue;
  }

  private scrollQueued = false;
  private readonly onScroll = (): void => {
    if (this.scrollQueued) return;
    this.scrollQueued = true;
    setTimeout(() => {
      this.scrollQueued = false;
      const line = innerHeight * 0.25;
      const el = this.o.elements.find((e) => !e.hidden && e.getBoundingClientRect().bottom > line);
      if (el?.dataset.block) this.o.onPosition(el.dataset.block);
      const atEnd =
        this.revealed === this.ends.length - 1 &&
        innerHeight + scrollY >= document.body.scrollHeight - 40;
      if (atEnd) this.o.onFinished();
    }, 400);
  };

  dispose(): void {
    this.abort.abort();
    this.observers.forEach((o) => o.disconnect());
    this.hosts.forEach((host) => host.dispose());
    this.hosts.clear();
    this.cue?.remove();
  }
}
