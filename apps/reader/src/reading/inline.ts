// Inline formatting for prose and dialogue: **bold**, *italic*, ++underline++, ~~strike~~,
// ==highlight== and backslash escapes. DOM is built with createTextNode / createElement only —
// never innerHTML — so any markup in the text renders as inert literal characters.

type Tag = 'strong' | 'em' | 'u' | 's' | 'mark';

/** Longest delimiters first so `**` is not read as two `*`. */
const DELIMS: readonly (readonly [string, Tag])[] = [
  ['**', 'strong'],
  ['++', 'u'],
  ['~~', 's'],
  ['==', 'mark'],
  ['*', 'em'],
];
const ESCAPABLE = '*_~+=\\';

function match(text: string, i: number): readonly [string, Tag] | undefined {
  for (const d of DELIMS) if (text.startsWith(d[0], i)) return d;
  return undefined;
}

/** Index of the closing delimiter for `delim` opened before `from`, honouring escapes. */
function findClose(text: string, from: number, delim: string): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] === '\\' && i + 1 < text.length && ESCAPABLE.includes(text[i + 1]!)) {
      i++;
      continue;
    }
    if (text.startsWith(delim, i)) {
      // `*` must not close on the first half of a `**`.
      if (delim === '*' && text[i + 1] === '*') {
        i++;
        continue;
      }
      return i;
    }
  }
  return -1;
}

function build(parent: Node, text: string): void {
  let buf = '';
  const flush = (): void => {
    if (buf) parent.appendChild(document.createTextNode(buf));
    buf = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '\\' && i + 1 < text.length && ESCAPABLE.includes(text[i + 1]!)) {
      buf += text[++i];
      continue;
    }
    const d = match(text, i);
    if (d) {
      const start = i + d[0].length;
      const end = findClose(text, start, d[0]);
      if (end > start) {
        flush();
        const el = document.createElement(d[1]);
        build(el, text.slice(start, end));
        parent.appendChild(el);
        i = end + d[0].length - 1;
        continue;
      }
      buf += d[0];
      i += d[0].length - 1;
      continue;
    }
    buf += ch;
  }
  flush();
}

/** Replaces `el`'s children with the formatted `text`. */
export function renderInline(el: HTMLElement, text: string): void {
  el.replaceChildren();
  build(el, text);
}
