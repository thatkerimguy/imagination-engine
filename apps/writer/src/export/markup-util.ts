// Helpers over the writer's inline markup shared by every exporter and importer. Pure.
import { inlineRuns, type InlineRun } from '../editor/inline-markup.ts';

type Flags = Pick<InlineRun, 'bold' | 'italic' | 'underline' | 'strike' | 'highlight' | 'fg'>;

const sameFlags = (a: Flags, b: Flags): boolean =>
  a.bold === b.bold &&
  a.italic === b.italic &&
  a.underline === b.underline &&
  a.strike === b.strike &&
  a.highlight === b.highlight &&
  a.fg === b.fg;

/** Merges neighbouring runs that share a style and drops empty ones. */
export function mergeRuns(runs: readonly InlineRun[]): InlineRun[] {
  const out: InlineRun[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (last && sameFlags(last, r)) out[out.length - 1] = { ...last, text: last.text + r.text };
    else out.push({ ...r });
  }
  return out;
}

/** Writer markup → merged styled runs. */
export const markupRuns = (text: string): InlineRun[] => mergeRuns(inlineRuns(text));

/** Same runs with every run forced italic (whisper / emphasis / gimmick cues). */
export const italicRuns = (runs: readonly InlineRun[]): InlineRun[] =>
  runs.map((r) => ({ ...r, italic: true }));

/** Escapes plain text so the writer markup parser reads it back literally. */
export function escapeMarkup(text: string): string {
  return text
    .replace(/\\(?=[*_~+=\\])/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/([+~=])\1/g, '\\$1$1');
}

/** Styled runs → writer markup (the inverse of `markupRuns`). */
export function runsToMarkup(runs: readonly InlineRun[]): string {
  let out = '';
  for (const r of mergeRuns(runs)) {
    let s = escapeMarkup(r.text);
    if (r.highlight) s = `==${s}==`;
    if (r.strike) s = `~~${s}~~`;
    if (r.underline) s = `++${s}++`;
    if (r.italic) s = `*${s}*`;
    if (r.bold) s = `**${s}**`;
    out += s;
  }
  return out;
}
