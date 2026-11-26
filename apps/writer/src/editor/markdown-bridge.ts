// Bridge between a prose run's writer source and react-native-enriched-markdown's input.
// The library edits CommonMark: one plain-text line per paragraph, `**bold**`, `*italic*`,
// `~~strike~~` and underline as `_x_` (Android) or `__x__`. Our source keeps paragraphs apart
// with a blank line and underline as `++x++`. Only runs whose source the library can show
// byte-for-byte are handed to it (`isEnrichedSafe`); everything else uses the plain surface, so
// highlights, colours, comments, escapes and wikilinks are never rewritten. Pure.
import { PARA } from './prose-runs.ts';

/** Characters / tokens the native editor would reinterpret or cannot render. */
const UNSAFE = /[{}[\]=\\_#>`|]|\+\+|^\s*(?:[-+*]|\d+[.)])\s/m;

/** True when the native rich editor round-trips this run's source exactly. */
export const isEnrichedSafe = (source: string): boolean => !UNSAFE.test(source);

/** Run source → value for the native editor (safe sources are already CommonMark). */
export const toEnriched = (source: string): string => source;

const UNDERLINE = /(^|[^\w_])(__?)(?=\S)([^_\n]+?)(?<=\S)\2(?![\w_])/g;

/** Native editor Markdown → run source: blank-line paragraphs, `++underline++`. */
export function fromEnriched(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((line) =>
      line.replace(UNDERLINE, (_m, pre: string, _d: string, body: string) => `${pre}++${body}++`),
    )
    .join(PARA);
}

const DELIMS = ['**', '~~', '++', '*'] as const;

/**
 * For each plain-text offset (0…plain length), the matching offset in `source`. Delimiters are
 * invisible in the native editor's text and each blank-line separator is a single `\n` there.
 */
export function plainToSourceMap(source: string): number[] {
  const map: number[] = [];
  for (let i = 0; i < source.length;) {
    if (source.startsWith(PARA, i)) {
      map.push(i);
      i += PARA.length;
      continue;
    }
    const d = DELIMS.find((x) => source.startsWith(x, i));
    if (d) {
      i += d.length;
      continue;
    }
    map.push(i);
    i++;
  }
  map.push(source.length);
  return map;
}

/** Native (plain-text) offset → source offset. */
export function plainToSource(source: string, plain: number): number {
  const map = plainToSourceMap(source);
  return map[Math.max(0, Math.min(plain, map.length - 1))]!;
}

/** Source offset → native (plain-text) offset: the first plain offset at or after it. */
export function sourceToPlain(source: string, offset: number): number {
  const map = plainToSourceMap(source);
  const at = map.findIndex((s) => s >= offset);
  return at < 0 ? map.length - 1 : at;
}
