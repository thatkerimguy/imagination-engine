// Pure find / replace over prose and dialogue text (raw markup text).
import type { Block, ChapterDocument } from '@kn/core';

export interface FindMatch {
  blockId: string;
  field: 'text';
  start: number;
  end: number;
}

export interface FindOptions {
  caseSensitive?: boolean;
}

const hasText = (b: Block): b is Extract<Block, { kind: 'prose' | 'dialogue' }> =>
  b.kind === 'prose' || b.kind === 'dialogue';

function indicesIn(text: string, query: string, caseSensitive: boolean): number[] {
  if (!query) return [];
  const hay = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const out: number[] = [];
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) {
    out.push(i);
  }
  return out;
}

export function findMatches(
  blocks: readonly Block[],
  query: string,
  opts: FindOptions = {},
): FindMatch[] {
  const out: FindMatch[] = [];
  for (const b of blocks) {
    if (!hasText(b)) continue;
    for (const start of indicesIn(b.text, query, !!opts.caseSensitive)) {
      out.push({ blockId: b.id, field: 'text', start, end: start + query.length });
    }
  }
  return out;
}

function mapBlock(
  chapter: ChapterDocument,
  blockId: string,
  fn: (text: string) => string,
): ChapterDocument {
  return {
    ...chapter,
    blocks: chapter.blocks.map((b): Block => {
      if (b.id !== blockId || !hasText(b)) return b;
      return { ...b, text: fn(b.text) };
    }),
  };
}

export function replaceOne(
  chapter: ChapterDocument,
  match: FindMatch,
  replacement: string,
): ChapterDocument {
  return mapBlock(
    chapter,
    match.blockId,
    (t) => t.slice(0, match.start) + replacement + t.slice(match.end),
  );
}

export function replaceAll(
  chapter: ChapterDocument,
  query: string,
  replacement: string,
  opts: FindOptions = {},
): { chapter: ChapterDocument; count: number } {
  let count = 0;
  let next = chapter;
  const byBlock = new Map<string, FindMatch[]>();
  for (const m of findMatches(chapter.blocks, query, opts)) {
    byBlock.set(m.blockId, [...(byBlock.get(m.blockId) ?? []), m]);
  }
  for (const [id, ms] of byBlock) {
    count += ms.length;
    // Apply right-to-left so earlier offsets stay valid.
    next = mapBlock(next, id, (t) =>
      [...ms].reverse().reduce((s, m) => s.slice(0, m.start) + replacement + s.slice(m.end), t),
    );
  }
  return { chapter: next, count };
}
