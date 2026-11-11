import { prefersReducedMotion } from '@ie/core';
import { createTranslator, localeTag, type Locale, type Translator } from '@ie/i18n';
import type { Beat, Layout, StoryRuntime } from '@ie/story';
import { Countdown } from './countdown.ts';
import { buildLine, type LineContext, type LineMode } from './lines.ts';
import { presentMessages, type PresentKey } from './messages.ts';
import { buildChoice, buildEnd, buildInput, type PromptHandlers } from './prompts.ts';
import { buildBattle, buildShop, type RpgHandlers } from './rpg-prompts.ts';
import { buildExits, type WorldHandlers } from './world-view.ts';
import { CHARS_PER_SECOND, reportTyped, Typewriter, type TextSpeed } from './typewriter.ts';

export interface PresenterHost extends PromptHandlers, RpgHandlers, WorldHandlers {
  /** A timed pause ran out. */
  advance(): void;
  /** Characters were just typed in; `speaker` is null for narration. Drives voice blips. */
  typed?(speaker: string | null, text: string): void;
  /** A fight waits: the host plays it and resolves it on the runtime. Called again on a redraw. */
  fight?(beat: Extract<Beat, { kind: 'fight' }>): void;
  /** A minigame waits: the host plays it and resolves it on the runtime. Called again on a redraw. */
  minigame?(beat: Extract<Beat, { kind: 'minigame' }>): void;
  /** A sequence waits: the host plays it and advances when it ends. Called again on a redraw. */
  sequence?(beat: Extract<Beat, { kind: 'sequence' }>): void;
}

export interface PresenterOptions {
  readonly locale: Locale;
  readonly speed: TextSpeed;
  /** Off: timed choices wait for the reader (an accessibility setting). */
  readonly timers: boolean;
  /** Inserts soft hyphens; loaded lazily per language. */
  readonly hyphenate?: (text: string, locale: Locale) => string;
}

interface Timed {
  /** Identifies the waiting beat, so a redraw keeps its clock instead of restarting it. */
  readonly key: string;
  readonly countdown: Countdown;
}

function reducedMotion(): boolean {
  return prefersReducedMotion();
}

/**
 * Draws a running story into the DOM: lines typed in, then the choice, answer field or ending.
 * It never decides anything; it shows what the runtime produced and reports what the reader did.
 */
export class StoryPresenter {
  readonly element: HTMLElement;
  private readonly page: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly typewriter: Typewriter;
  private t: Translator<PresentKey>;
  private layout: Layout = 'page';
  private timed: Timed | null = null;
  private held = false;

  constructor(
    private runtime: StoryRuntime,
    private readonly host: PresenterHost,
    private options: PresenterOptions,
  ) {
    this.t = createTranslator(presentMessages, options.locale);
    this.typewriter = new Typewriter(CHARS_PER_SECOND[options.speed]);
    this.page = document.createElement('div');
    this.page.className = 'story__page';
    this.page.setAttribute('aria-live', 'polite');
    this.prompt = document.createElement('div');
    this.prompt.className = 'story__prompt';
    this.element = document.createElement('div');
    this.element.className = 'story';
    this.element.dataset.testid = 'story';
    this.element.lang = localeTag(options.locale);
    this.element.append(this.page, this.prompt);
  }

  /** True while a line is still being typed; a tap should finish it rather than advance. */
  get busy(): boolean {
    return this.typewriter.busy;
  }

  skip(): void {
    this.typewriter.skip();
  }

  /** Swaps in another runtime (restart, load) and clears the page; follow with show() or redraw(). */
  attach(runtime: StoryRuntime): void {
    this.runtime = runtime;
    this.typewriter.cancel();
    this.stopTimer();
    this.page.replaceChildren();
    this.prompt.replaceChildren();
  }

  setOptions(next: PresenterOptions): void {
    const previous = this.options;
    this.options = next;
    this.typewriter.setSpeed(CHARS_PER_SECOND[next.speed]);
    if (next.locale !== previous.locale) {
      this.t = createTranslator(presentMessages, next.locale);
      this.element.lang = localeTag(next.locale);
    }
    if (
      next.locale !== previous.locale ||
      next.timers !== previous.timers ||
      next.hyphenate !== previous.hyphenate
    ) {
      if (!next.timers) this.stopTimer();
      this.redraw();
    }
  }

  /** Holds the clocks while the menu or a panel covers the page. */
  hold(on: boolean): void {
    this.held = on;
    const countdown = this.timed?.countdown;
    if (!countdown) return;
    if (on) countdown.pause();
    else countdown.resume();
    const bar = this.prompt.querySelector<HTMLElement>('.choices__timer');
    if (bar) {
      if (on) bar.dataset.paused = 'true';
      else delete bar.dataset.paused;
    }
  }

  /** Number keys pick options. Returns true when the key was used. */
  handleKey(key: string): boolean {
    if (!/^[1-9]$/.test(key)) return false;
    const buttons = this.prompt.querySelectorAll<HTMLButtonElement>('.choice');
    const button = buttons[Number(key) - 1];
    if (!button) return false;
    button.click();
    return true;
  }

  /** Shows beats the runtime just produced: the newest line is typed in, then the prompt appears. */
  show(beats: readonly Beat[]): void {
    this.typewriter.skip();
    this.stopTimer(); // the choice it belonged to has been answered
    this.prompt.replaceChildren();
    delete this.element.dataset.redraw;
    const typed = this.options.speed !== 'instant';
    const lastLine = beats.findLast((b) => b.kind === 'line');
    let steps: ReturnType<typeof buildLine> = null;
    for (const beat of beats) {
      if (beat.kind === 'passage') {
        this.enterPassage(beat, true);
        continue;
      }
      const built = buildLine(
        beat,
        this.lineContext(),
        this.mode(typed && beat === lastLine, true),
      );
      if (!built) continue;
      this.appendLine(built.element);
      if (built.steps.length) steps = built;
    }
    const done = () => this.showWaiting();
    if (steps) this.typewriter.play(this.withVoice(steps), done);
    else done();
  }

  /** Rebuilds the current page at once: after a language switch, a rewind, a load or a reload. */
  redraw(): void {
    this.typewriter.cancel();
    this.prompt.replaceChildren();
    this.page.replaceChildren();
    this.element.dataset.redraw = 'true';
    for (const beat of this.runtime.page()) {
      if (beat.kind === 'passage') {
        this.enterPassage(beat);
        continue;
      }
      const built = buildLine(beat, this.lineContext(), this.mode(false, false));
      if (built) this.appendLine(built.element, false);
    }
    this.showWaiting(false);
  }

  private withVoice(line: NonNullable<ReturnType<typeof buildLine>>) {
    const typed = this.host.typed?.bind(this.host);
    if (!typed) return line.steps;
    const speaker = line.element.dataset.speaker ?? null;
    return reportTyped(line.steps, (text) => typed(speaker, text));
  }

  dispose(): void {
    this.typewriter.cancel();
    this.stopTimer();
    this.element.remove();
  }

  private mode(typed: boolean, animate: boolean): LineMode {
    return { typed, animate, cps: CHARS_PER_SECOND[this.options.speed] };
  }

  private lineContext(): LineContext {
    const { hyphenate, locale } = this.options;
    return {
      runtime: this.runtime,
      locale,
      t: this.t,
      layout: this.layout,
      ...(hyphenate ? { hyphenate: (text: string) => hyphenate(text, locale) } : {}),
    };
  }

  private enterPassage(beat: Extract<Beat, { kind: 'passage' }>, turn = false): void {
    if (!beat.keepPage) {
      this.page.replaceChildren();
      if (turn) this.turnPage();
    }
    this.layout = beat.layout;
    this.element.dataset.layout = beat.layout;
  }

  /** The story theme's page transition (ADR 0018): one compositor-only animation per new page. */
  private turnPage(): void {
    const kind = this.element.closest<HTMLElement>('[data-transition]')?.dataset.transition;
    if (!kind || kind === 'none' || reducedMotion() || typeof this.page.animate !== 'function')
      return;
    const frames =
      kind === 'rise'
        ? [
            { opacity: 0, transform: 'translateY(0.75rem)' },
            { opacity: 1, transform: 'none' },
          ]
        : [{ opacity: 0 }, { opacity: 1 }];
    this.page.animate(frames, { duration: 320, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
  }

  private appendLine(line: HTMLElement, scroll = true): void {
    const previous = this.page.lastElementChild as HTMLElement | null;
    // A run of lines from one speaker names them once.
    if (line.dataset.speaker && previous?.dataset.speaker === line.dataset.speaker)
      line.dataset.continued = 'true';
    this.page.querySelector('[data-current]')?.removeAttribute('data-current');
    line.dataset.current = 'true';
    this.page.append(line);
    if (scroll) this.reveal(line);
  }

  private reveal(node: HTMLElement): void {
    node.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  private showWaiting(animate = true): void {
    const beat = this.runtime.waiting;
    const handlers = this.host;
    if (!beat) return;
    const key = `${this.runtime.log.length}:${'blockId' in beat ? beat.blockId : ''}`;
    let shown: HTMLElement | null = null;
    if (beat.kind === 'choice') {
      const countdown =
        beat.timer && this.options.timers
          ? this.timer(key, beat.timer.seconds, () =>
              handlers.choose(beat.timer?.defaultOption ?? ''),
            )
          : null;
      shown = buildChoice(beat, { runtime: this.runtime, t: this.t }, handlers, countdown);
    } else if (beat.kind === 'input') {
      const form = buildInput(beat, { runtime: this.runtime, t: this.t }, handlers);
      this.prompt.append(form);
      form.querySelector('input')?.focus({ preventScroll: true });
      if (animate) this.reveal(form);
      return;
    } else if (beat.kind === 'end') {
      shown = buildEnd(beat, { runtime: this.runtime, t: this.t }, handlers);
    } else if (beat.kind === 'fight') {
      handlers.fight?.(beat);
    } else if (beat.kind === 'minigame') {
      handlers.minigame?.(beat);
    } else if (beat.kind === 'sequence') {
      handlers.sequence?.(beat);
    } else if (beat.kind === 'shop') {
      shown = buildShop({ runtime: this.runtime, t: this.t }, handlers);
    } else if (beat.kind === 'battle') {
      shown = buildBattle({ runtime: this.runtime, t: this.t }, handlers);
    } else if (beat.kind === 'exits') {
      shown = buildExits(beat, { runtime: this.runtime, t: this.t }, handlers);
    } else if (beat.kind === 'pause' && beat.seconds !== undefined) {
      this.timer(key, beat.seconds, () => handlers.advance());
    }
    if (!shown) return;
    this.prompt.append(shown);
    if (animate) this.reveal(shown);
  }

  /** Starts (or, on a redraw of the same beat, keeps) the clock for a timed beat. */
  private timer(key: string, seconds: number, onDone: () => void): Countdown {
    if (this.timed?.key === key) return this.timed.countdown;
    this.stopTimer();
    const countdown = new Countdown(seconds * 1000, () => {
      this.timed = null;
      onDone();
    });
    this.timed = { key, countdown };
    if (!this.held) countdown.start();
    return countdown;
  }

  private stopTimer(): void {
    this.timed?.countdown.cancel();
    this.timed = null;
  }
}
