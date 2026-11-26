import { renderWikilinks } from '@kn/core';
// Inline markup shared by the editor, analyzers and the reader bridge.
// Core spans (also rendered by apps/reader): **bold** *italic* ++underline++ ~~strike~~ ==highlight==
// Writer-only spans (stripped before anything leaves the writer): {fg:#hex}…{/fg} {bg:#hex}…{/bg}
// and {{comment:note}}; [[Title|Alias]] wikilinks are rendered to their display text. A backslash escapes * _ ~ + = \ (matching apps/reader/src/reading/inline.ts).

export type MarkKind = 'bold' | 'italic' | 'underline' | 'strike' | 'highlight';
export type ColorChannel = 'fg' | 'bg';

export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'mark'; mark: MarkKind; children: InlineNode[] }
  | { type: 'color'; channel: ColorChannel; color: string; children: InlineNode[] }
  | { type: 'comment'; note: string };

/** A flat run of text with every style that applies to it — what a <Text> span needs. */
export interface InlineRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  highlight: boolean;
  fg?: string;
  bg?: string;
  /** Set on a zero-text run marking where a {{comment:…}} sits. */
  comment?: string;
}

/** Longest delimiters first so `**` is never read as two `*`. */
export const MARK_DELIMS: readonly (readonly [string, MarkKind])[] = [
  ['**', 'bold'],
  ['++', 'underline'],
  ['~~', 'strike'],
  ['==', 'highlight'],
  ['*', 'italic'],
];
export const DELIM_OF: Readonly<Record<MarkKind, string>> = {
  bold: '**',
  italic: '*',
  underline: '++',
  strike: '~~',
  highlight: '==',
};

const ESCAPABLE = '*_~+=\\';
const COLOR_OPEN = /^\{(fg|bg):(#[0-9a-fA-F]{6})\}/;
const COMMENT_OPEN = '{{comment:';

const isEscape = (s: string, i: number): boolean =>
  s[i] === '\\' && i + 1 < s.length && ESCAPABLE.includes(s[i + 1]!);

function markAt(s: string, i: number): readonly [string, MarkKind] | undefined {
  for (const d of MARK_DELIMS) if (s.startsWith(d[0], i)) return d;
  return undefined;
}

/** Length of a writer-only token at `i` ({fg:…}, {/fg}, {{comment:…}}), or 0. */
function writerTokenAt(s: string, i: number): number {
  if (s[i] !== '{') return 0;
  if (s.startsWith(COMMENT_OPEN, i)) {
    const end = s.indexOf('}}', i + COMMENT_OPEN.length);
    return end < 0 ? 0 : end + 2 - i;
  }
  if (s.startsWith('{/fg}', i) || s.startsWith('{/bg}', i)) return 5;
  const m = COLOR_OPEN.exec(s.slice(i, i + 12));
  return m ? m[0].length : 0;
}

function findMarkClose(s: string, from: number, delim: string): number {
  for (let i = from; i < s.length; i++) {
    if (isEscape(s, i)) {
      i++;
      continue;
    }
    const w = writerTokenAt(s, i);
    if (w && s.startsWith(COMMENT_OPEN, i)) {
      i += w - 1;
      continue;
    }
    if (s.startsWith(delim, i)) {
      if (delim === '*' && s[i + 1] === '*') {
        i++;
        continue;
      }
      return i;
    }
  }
  return -1;
}

function findColorClose(s: string, from: number, channel: ColorChannel): number {
  let depth = 0;
  for (let i = from; i < s.length; i++) {
    if (isEscape(s, i)) {
      i++;
      continue;
    }
    if (s.startsWith(`{${channel}:`, i) && COLOR_OPEN.test(s.slice(i, i + 12))) depth++;
    else if (s.startsWith(`{/${channel}}`, i)) {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

/** Parses writer markup into an AST. Unmatched delimiters stay literal text. */
export function parseInline(s: string): InlineNode[] {
  const out: InlineNode[] = [];
  let buf = '';
  const flush = (): void => {
    if (buf) out.push({ type: 'text', text: buf });
    buf = '';
  };
  for (let i = 0; i < s.length; i++) {
    if (isEscape(s, i)) {
      buf += s[++i];
      continue;
    }
    if (s.startsWith(COMMENT_OPEN, i)) {
      const end = s.indexOf('}}', i + COMMENT_OPEN.length);
      if (end >= 0) {
        flush();
        out.push({ type: 'comment', note: s.slice(i + COMMENT_OPEN.length, end) });
        i = end + 1;
        continue;
      }
    }
    const color = s[i] === '{' ? COLOR_OPEN.exec(s.slice(i, i + 12)) : null;
    if (color) {
      const channel = color[1] as ColorChannel;
      const start = i + color[0].length;
      const end = findColorClose(s, start, channel);
      if (end >= 0) {
        flush();
        out.push({
          type: 'color',
          channel,
          color: color[2]!,
          children: parseInline(s.slice(start, end)),
        });
        i = end + 4;
        continue;
      }
    }
    const d = markAt(s, i);
    if (d) {
      const start = i + d[0].length;
      const end = findMarkClose(s, start, d[0]);
      if (end > start) {
        flush();
        out.push({ type: 'mark', mark: d[1], children: parseInline(s.slice(start, end)) });
        i = end + d[0].length - 1;
        continue;
      }
      buf += d[0];
      i += d[0].length - 1;
      continue;
    }
    buf += s[i];
  }
  flush();
  return out;
}

const PLAIN: InlineRun = {
  text: '',
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  highlight: false,
};

/** Flattens the AST into styled runs (adjacent text in the same style is not merged). */
export function inlineRuns(s: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const walk = (nodes: InlineNode[], style: InlineRun): void => {
    for (const n of nodes) {
      if (n.type === 'text') runs.push({ ...style, text: n.text });
      else if (n.type === 'comment') runs.push({ ...style, text: '', comment: n.note });
      else if (n.type === 'mark') walk(n.children, { ...style, [n.mark]: true });
      else walk(n.children, { ...style, [n.channel]: n.color });
    }
  };
  walk(parseInline(s), PLAIN);
  return runs;
}

/** Plain text only: every delimiter, colour tag and comment removed, escapes resolved. */
export function stripInlineMarkup(s: string): string {
  return inlineRuns(s)
    .map((r) => r.text)
    .join('');
}

/**
 * What the reader receives: core spans and escapes kept byte-for-byte, writer-only colour tags
 * and comments removed, `[[Title|Alias]]` wikilinks shown as their alias (or title). Text without writer-only tokens is returned unchanged.
 */
export function sanitizeForReader(src: string): string {
  const s = renderWikilinks(src);
  if (!s.includes('{')) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (isEscape(s, i)) {
      out += s[i]! + s[i + 1]!;
      i++;
      continue;
    }
    const w = writerTokenAt(s, i);
    if (w) {
      i += w - 1;
      continue;
    }
    out += s[i];
  }
  return out;
}

/** True when the text holds writer-only tokens that sanitizeForReader would remove. */
export const hasWriterOnlyMarkup = (s: string): boolean => sanitizeForReader(s) !== s;
