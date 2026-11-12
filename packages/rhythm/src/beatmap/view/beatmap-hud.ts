import type { Translator } from '@ie/i18n';
import type { InputKey } from './beatmap-input.ts';
import type { BeatmapKey } from './messages.ts';

export type BeatmapText = Translator<BeatmapKey>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  parent?.append(node);
  return node;
}

export function button(
  parent: HTMLElement,
  text: string,
  onClick: () => void,
  primary = false,
): HTMLButtonElement {
  const b = el('button', primary ? 'ie-button ie-button--primary' : 'ie-button', parent, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export interface HudState {
  readonly score: number;
  readonly accuracy: number;
  readonly combo: number;
  readonly health: number;
  readonly progress: number;
  readonly resting: boolean;
  readonly canSkip: boolean;
}

const KEY_LABELS: readonly (readonly [InputKey, string])[] = [
  ['k1', 'Z'],
  ['k2', 'X'],
  ['m1', 'M1'],
  ['m2', 'M2'],
];

/**
 * The beatmap screen's DOM: the canvas, the bars and numbers around it, the key counters, and a
 * panel for the start card, the pause menu and the results. Numbers are only written when they
 * change, so the frame loop touches the DOM rarely.
 */
export class BeatmapHud {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  private readonly panel: HTMLElement;
  private readonly score: HTMLElement;
  private readonly accuracy: HTMLElement;
  private readonly combo: HTMLElement;
  private readonly health: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly rest: HTMLElement;
  private readonly skip: HTMLButtonElement;
  private readonly keys = new Map<InputKey, { box: HTMLElement; count: HTMLElement; n: number }>();
  private last: Partial<Record<keyof HudState, number | boolean>> = {};
  private readonly numbers: Intl.NumberFormat;
  private readonly percent: Intl.NumberFormat;

  constructor(
    host: HTMLElement,
    text: BeatmapText,
    options: { readonly contained?: boolean; readonly onPause: () => void; readonly onSkip: () => void },
  ) {
    const tag = text.locale === 'tr' ? 'tr-TR' : 'en-GB';
    this.numbers = new Intl.NumberFormat(tag);
    this.percent = new Intl.NumberFormat(tag, {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    this.root = el('div', options.contained ? 'ie-bm ie-bm--contained' : 'ie-bm');
    this.root.dataset.testid = 'beatmap';
    this.root.setAttribute('role', 'application');
    this.root.setAttribute('aria-label', text('bm.label'));
    this.canvas = el('canvas', 'ie-bm__canvas', this.root);
    this.canvas.dataset.testid = 'beatmap-field';

    const top = el('div', 'ie-bm__top', this.root);
    const pause = el('button', 'ie-bm__pause', top);
    pause.type = 'button';
    pause.dataset.testid = 'beatmap-pause';
    pause.setAttribute('aria-label', text('bm.pause'));
    pause.addEventListener('click', options.onPause);
    el('span', 'ie-bm__pause-glyph', pause).setAttribute('aria-hidden', 'true');
    const bars = el('div', 'ie-bm__bars', top);
    this.health = this.bar(bars, 'ie-bm__bar ie-bm__bar--health', text('bm.health'));
    this.progress = this.bar(bars, 'ie-bm__bar ie-bm__bar--progress', text('bm.progress'));
    const numbers = el('div', 'ie-bm__numbers', top);
    this.score = el('div', 'ie-bm__score', numbers, '0');
    this.score.dataset.testid = 'beatmap-score';
    this.accuracy = el('div', 'ie-bm__accuracy', numbers);
    this.accuracy.dataset.testid = 'beatmap-accuracy';

    this.combo = el('div', 'ie-bm__combo', this.root);
    this.combo.dataset.testid = 'beatmap-combo';
    this.rest = el('div', 'ie-bm__rest', this.root, text('bm.break'));
    this.rest.hidden = true;

    const keys = el('div', 'ie-bm__keys', this.root);
    keys.setAttribute('aria-label', text('bm.keys'));
    for (const [key, label] of KEY_LABELS) {
      const box = el('div', 'ie-bm__key', keys);
      el('span', 'ie-bm__key-name', box, label);
      const count = el('span', 'ie-bm__key-count', box, '0');
      this.keys.set(key, { box, count, n: 0 });
    }

    this.skip = button(this.root, text('bm.skip'), options.onSkip);
    this.skip.classList.add('ie-bm__skip');
    this.skip.dataset.testid = 'beatmap-skip';
    this.skip.hidden = true;

    this.panel = el('div', 'ie-bm__panel', this.root);
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'true');
    this.panel.hidden = true;
    host.append(this.root);
  }

  private bar(parent: HTMLElement, className: string, label: string): HTMLElement {
    const bar = el('div', className, parent);
    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-label', label);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    return el('span', 'ie-bm__fill', bar);
  }

  setDim(dim: number): void {
    this.root.style.setProperty('--bm-dim', String(Math.max(0, Math.min(1, dim))));
  }

  update(s: HudState): void {
    const last = this.last;
    if (last.score !== s.score) this.score.textContent = this.numbers.format(s.score);
    const acc = Math.round(s.accuracy * 10000);
    if (last.accuracy !== acc) this.accuracy.textContent = this.percent.format(acc / 10000);
    if (last.combo !== s.combo)
      this.combo.textContent = s.combo > 0 ? `${this.numbers.format(s.combo)}×` : '';
    const health = Math.round(s.health * 200) / 200;
    if (last.health !== health) {
      this.health.style.transform = `scaleX(${health})`;
      this.health.parentElement?.setAttribute('aria-valuenow', String(Math.round(health * 100)));
    }
    const progress = Math.round(s.progress * 500) / 500;
    if (last.progress !== progress) this.progress.style.transform = `scaleX(${progress})`;
    if (last.resting !== s.resting) this.rest.hidden = !s.resting;
    if (last.canSkip !== s.canSkip) this.skip.hidden = !s.canSkip;
    this.last = { score: s.score, accuracy: acc, combo: s.combo, health, progress, resting: s.resting, canSkip: s.canSkip };
  }

  key(key: InputKey, down: boolean): void {
    const k = this.keys.get(key);
    if (!k) return;
    k.box.classList.toggle('is-down', down);
    if (down) k.count.textContent = String(++k.n);
  }

  resetKeys(): void {
    for (const k of this.keys.values()) {
      k.n = 0;
      k.count.textContent = '0';
      k.box.classList.remove('is-down');
    }
  }

  /** Shows a card over the field (start, pause, results), or hides it with null. */
  showPanel(content: HTMLElement | null): void {
    this.panel.replaceChildren(...(content ? [content] : []));
    this.panel.hidden = !content;
    this.root.classList.toggle('has-panel', !!content);
    if (content) content.querySelector<HTMLElement>('.ie-button--primary, button')?.focus();
  }

  get panelOpen(): boolean {
    return !this.panel.hidden;
  }

  dispose(): void {
    this.root.remove();
  }
}
