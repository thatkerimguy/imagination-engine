/**
 * The text field's view of markup (ADR 0007): plain text plus atomic tokens that show as chips, so
 * authors never type `{gold}` or `[shake]`. Splitting and joining round-trips the stored string.
 */

export type Token =
  | { readonly kind: 'var'; readonly raw: string; readonly id: string }
  | { readonly kind: 'char'; readonly raw: string; readonly id: string }
  /** plural/select and anything else in braces: kept whole. */
  | { readonly kind: 'icu'; readonly raw: string; readonly id: string }
  | { readonly kind: 'open'; readonly raw: string; readonly name: string; readonly arg?: string }
  | { readonly kind: 'close'; readonly raw: string; readonly name: string }
  | { readonly kind: 'pause'; readonly raw: string; readonly ms: number }
  /** Malformed markup from a file: kept exactly so nothing is lost. */
  | { readonly kind: 'raw'; readonly raw: string };

export type Segment = { readonly kind: 'text'; readonly text: string } | Token;

function braceEnd(source: string, start: number): number {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const c = source.charAt(i);
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

function braceToken(raw: string): Token {
  const inner = raw.slice(1, -1).trim();
  const simple = /^(@?)([A-Za-z][A-Za-z0-9_]*)$/.exec(inner);
  if (simple) return { kind: simple[1] ? 'char' : 'var', raw, id: simple[2] ?? '' };
  const id = /^([A-Za-z][A-Za-z0-9_]*)\s*,/.exec(inner)?.[1];
  return id ? { kind: 'icu', raw, id } : { kind: 'raw', raw };
}

function tagToken(source: string, i: number): Token | null {
  const rest = source.slice(i);
  const close = /^\[\/([a-z]+)\]/.exec(rest);
  if (close) return { kind: 'close', raw: close[0], name: close[1] ?? '' };
  const open = /^\[([a-z]+)(?:=([^\]]*))?\]/.exec(rest);
  if (!open) return null;
  const name = open[1] ?? '';
  if (name === 'pause') return { kind: 'pause', raw: open[0], ms: Number(open[2]) || 0 };
  return open[2] === undefined
    ? { kind: 'open', raw: open[0], name }
    : { kind: 'open', raw: open[0], name, arg: open[2] };
}

export function splitMarkup(source: string): Segment[] {
  const out: Segment[] = [];
  let text = '';
  const flush = () => {
    if (text) out.push({ kind: 'text', text });
    text = '';
  };
  for (let i = 0; i < source.length;) {
    const two = source.slice(i, i + 2);
    if (two === '[[' || two === ']]' || two === '{{') {
      text += two.charAt(0);
      i += 2;
      continue;
    }
    const c = source.charAt(i);
    if (c === '{') {
      const end = braceEnd(source, i);
      if (end > i) {
        flush();
        out.push(braceToken(source.slice(i, end + 1)));
        i = end + 1;
        continue;
      }
    }
    if (c === '[') {
      const token = tagToken(source, i);
      flush();
      out.push(token ?? { kind: 'raw', raw: c });
      i += token ? token.raw.length : 1;
      continue;
    }
    text += c;
    i++;
  }
  flush();
  return out;
}

export function escapeText(text: string): string {
  return text.replace(/[[\]{]/g, (c) => c + c);
}

/**
 * Joins segments back into markup. An effect tag whose partner was deleted is dropped too, so
 * removing one chip of a pair never leaves the line broken.
 */
export function joinMarkup(segments: readonly Segment[]): string {
  const keep = new Set<number>();
  const stack: { name: string; index: number }[] = [];
  segments.forEach((s, index) => {
    if (s.kind === 'open') stack.push({ name: s.name, index });
    else if (s.kind === 'close') {
      const at = stack.findLastIndex((o) => o.name === s.name);
      if (at < 0) return;
      // Tags opened after the match can't close any more; they are orphans.
      keep.add(stack[at]?.index ?? -1);
      keep.add(index);
      stack.length = at;
    }
  });
  return segments
    .map((s, index) => {
      if (s.kind === 'text') return escapeText(s.text);
      if ((s.kind === 'open' || s.kind === 'close') && !keep.has(index)) return '';
      return s.raw;
    })
    .join('');
}

/** The plain text a reader would see, for previews in lists and the Flow map. */
export function previewText(source: string, name: (token: Token) => string): string {
  return splitMarkup(source)
    .map((s) => (s.kind === 'text' ? s.text : s.kind === 'var' || s.kind === 'char' ? name(s) : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
