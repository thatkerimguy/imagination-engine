import type { Effect, Piece } from '@ie/story';
import type { RevealStep } from './typewriter.ts';

/** Effects drawn per character (each letter moves on its own). */
const PER_CHAR = new Set(['shake', 'tremble', 'wave']);
/** Effects that reveal a whole run at once and animate it. */
const WHOLE = new Set(['fade', 'scramble']);
/** Colour names a story may use; present.css maps each to a theme token. */
const COLORS = new Set(['accent', 'muted', 'faint', 'ink']);

export interface BuildOptions {
  /** Hide the text so a typewriter can reveal it. */
  readonly typed: boolean;
  /** Play one-shot effects such as scramble (false when redrawing a page). */
  readonly animate: boolean;
  readonly hyphenate?: (text: string) => string;
}

export interface BuiltText {
  readonly fragment: DocumentFragment;
  readonly steps: RevealStep[];
  /** The words alone, for screen readers. */
  readonly plain: string;
}

function span(className: string, text?: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function elementFor(effect: Effect): HTMLElement | null {
  switch (effect.name) {
    case 'b':
      return document.createElement('strong');
    case 'i':
      return document.createElement('em');
    case 'speed':
      return null;
    case 'color': {
      if (!effect.arg || !COLORS.has(effect.arg)) return null;
      const el = span('fx-color');
      el.dataset.color = effect.arg;
      return el;
    }
    default:
      return span(`fx-${effect.name}`);
  }
}

function speedOf(fx: readonly Effect[]): number {
  const effect = fx.findLast((e) => e.name === 'speed');
  const value = Number(effect?.arg);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.max(value, 0.1), 8) : 1;
}

/** Never stop a reveal between the two halves of an emoji. */
function safeCut(text: string, n: number): number {
  const code = text.charCodeAt(n - 1);
  return code >= 0xd800 && code <= 0xdbff ? n + 1 : n;
}

function plainRun(parent: ParentNode, text: string, typed: boolean, speed: number): RevealStep[] {
  if (!typed) {
    parent.append(text);
    return [];
  }
  const shown = document.createTextNode('');
  const rest = document.createTextNode(text);
  const hidden = span('tw-rest');
  hidden.append(rest);
  parent.append(shown, hidden);
  return [
    {
      kind: 'chars',
      text,
      speed,
      reveal: (count) => {
        const cut = safeCut(text, count);
        shown.data = text.slice(0, cut);
        rest.data = text.slice(cut);
      },
    },
  ];
}

/** Letters in their own boxes, grouped into unbreakable words so lines still wrap at spaces. */
function charRun(parent: ParentNode, text: string, typed: boolean, speed: number): RevealStep[] {
  const byIndex: (HTMLElement | null)[] = [];
  let word: HTMLElement | null = null;
  let letter = 0;
  for (const char of text) {
    if (/\s/.test(char)) {
      word = null;
      parent.append(char);
      byIndex.push(null);
      continue;
    }
    if (!word) {
      word = span('fx-word');
      parent.append(word);
    }
    const box = span(typed ? 'fx-char tw-off' : 'fx-char', char);
    box.style.setProperty('--i', String(letter++));
    word.append(box);
    byIndex.push(box);
    if (char.length > 1) byIndex.push(null);
  }
  if (!typed) return [];
  let revealed = 0;
  return [
    {
      kind: 'chars',
      text,
      speed,
      reveal: (count) => {
        for (; revealed < count; revealed++) byIndex[revealed]?.classList.remove('tw-off');
      },
    },
  ];
}

const SCRAMBLE_GLYPHS = 'abcdefghijklmnoprstuvyzçğıöşü#%&*+=?/';

/** Letters tumble through random glyphs and settle left to right. Skipped with reduced motion. */
function scramble(node: Text, text: string): void {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
    return;
  const chars = Array.from(text);
  const frames = 14;
  let frame = 0;
  const timer = setInterval(() => {
    frame++;
    const settled = Math.floor((frame / frames) * chars.length);
    node.data = chars
      .map((c, i) =>
        i < settled || /\s/.test(c)
          ? c
          : SCRAMBLE_GLYPHS.charAt(Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)),
      )
      .join('');
    if (frame >= frames) {
      clearInterval(timer);
      node.data = text;
    }
  }, 32);
}

function wholeRun(
  parent: ParentNode,
  text: string,
  fx: readonly Effect[],
  options: BuildOptions,
): RevealStep[] {
  const node = document.createTextNode(text);
  const box = span(options.typed ? 'tw-whole tw-off' : 'tw-whole');
  box.append(node);
  parent.append(box);
  const scrambles = fx.some((e) => e.name === 'scramble');
  const show = () => {
    box.classList.remove('tw-off');
    if (scrambles && options.animate) scramble(node, text);
  };
  if (!options.typed) {
    show();
    return [];
  }
  return [{ kind: 'whole', length: text.length, reveal: show }];
}

/** Builds rendered pieces into DOM, plus the steps a typewriter needs to reveal them. */
export function buildText(pieces: readonly Piece[], options: BuildOptions): BuiltText {
  const fragment = document.createDocumentFragment();
  const steps: RevealStep[] = [];
  let plain = '';
  for (const piece of pieces) {
    if (piece.kind === 'pause') {
      if (options.typed) steps.push({ kind: 'pause', ms: piece.ms });
      continue;
    }
    plain += piece.text;
    let parent: ParentNode = fragment;
    for (const effect of piece.fx) {
      const el = elementFor(effect);
      if (!el) continue;
      parent.append(el);
      parent = el;
    }
    const speed = speedOf(piece.fx);
    if (piece.fx.some((e) => PER_CHAR.has(e.name))) {
      // Letters in separate boxes can't hyphenate; these runs are short phrases anyway.
      steps.push(...charRun(parent, piece.text, options.typed, speed));
      continue;
    }
    const text = options.hyphenate ? options.hyphenate(piece.text) : piece.text;
    if (piece.fx.some((e) => WHOLE.has(e.name)))
      steps.push(...wholeRun(parent, text, piece.fx, options));
    else steps.push(...plainRun(parent, text, options.typed, speed));
  }
  return { fragment, steps, plain };
}
