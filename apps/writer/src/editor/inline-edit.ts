// Selection-aware editing helpers for writer markup: toggle a core span, wrap in a colour,
// insert a comment or raw text. Pure functions over (text, selection) → (text, selection).
import { DELIM_OF, type ColorChannel, type MarkKind } from './inline-markup.ts';

export interface Selection {
  start: number;
  end: number;
}

export interface EditResult {
  text: string;
  selection: Selection;
}

const norm = (sel: Selection): Selection =>
  sel.start <= sel.end ? sel : { start: sel.end, end: sel.start };

/** Replaces the selection with `insert`, leaving the caret after it. */
export function insertText(text: string, sel: Selection, insert: string): EditResult {
  const { start, end } = norm(sel);
  const caret = start + insert.length;
  return {
    text: text.slice(0, start) + insert + text.slice(end),
    selection: { start: caret, end: caret },
  };
}

/** Is `delim` sitting exactly at `i` and not part of a longer run of the same character? */
function delimAt(text: string, i: number, delim: string): boolean {
  if (i < 0 || !text.startsWith(delim, i)) return false;
  if (delim !== '*') return true;
  // A lone `*` (italic) must not be half of a `**` (bold) pair.
  return text[i - 1] !== '*' && text[i + 1] !== '*';
}

/**
 * Toggles a core span around the selection.
 * - Selection already wrapped (delimiters just outside or just inside it): unwraps.
 * - Non-empty selection: wraps it, keeping the same text selected.
 * - Empty selection: inserts an empty pair with the caret between the delimiters.
 */
export function toggleMark(text: string, sel: Selection, mark: MarkKind): EditResult {
  const d = DELIM_OF[mark];
  const n = d.length;
  const { start, end } = norm(sel);

  if (delimAt(text, start - n, d) && delimAt(text, end, d)) {
    return {
      text: text.slice(0, start - n) + text.slice(start, end) + text.slice(end + n),
      selection: { start: start - n, end: end - n },
    };
  }
  const inner = text.slice(start, end);
  if (inner.length >= 2 * n + 1 && delimAt(inner, 0, d) && delimAt(inner, inner.length - n, d)) {
    return {
      text: text.slice(0, start) + inner.slice(n, inner.length - n) + text.slice(end),
      selection: { start, end: end - 2 * n },
    };
  }
  return {
    text: text.slice(0, start) + d + inner + d + text.slice(end),
    selection: { start: start + n, end: end + n },
  };
}

/** Wraps the selection in a writer-only colour span (`{fg:#hex}…{/fg}` / `{bg:#hex}…{/bg}`). */
export function wrapColor(
  text: string,
  sel: Selection,
  channel: ColorChannel,
  hex: string,
): EditResult {
  const { start, end } = norm(sel);
  const open = `{${channel}:${hex}}`;
  const close = `{/${channel}}`;
  return {
    text: text.slice(0, start) + open + text.slice(start, end) + close + text.slice(end),
    selection: { start: start + open.length, end: end + open.length },
  };
}

/** Inserts a writer-only `{{comment:note}}` at the end of the selection. */
export function insertComment(text: string, sel: Selection, note: string): EditResult {
  const at = norm(sel).end;
  const safe = note.replace(/\}\}/g, '} }').trim();
  return insertText(text, { start: at, end: at }, `{{comment:${safe}}}`);
}
