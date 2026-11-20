import type { Block, ChapterDocument } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { findMatches, replaceAll, replaceOne } from './find-replace.ts';

const blocks = [
  { id: 'a', kind: 'prose', text: 'The cat and the Cat.' },
  { id: 'b', kind: 'dialogue', speaker: 'X', text: 'cat?' },
  { id: 'c', kind: 'scene-break' },
] as unknown as Block[];
const chapter = { blocks } as unknown as ChapterDocument;

describe('find-replace', () => {
  it('finds case-insensitively by default', () => {
    expect(findMatches(blocks, 'cat')).toHaveLength(3);
    expect(findMatches(blocks, 'cat', { caseSensitive: true })).toHaveLength(2);
    expect(findMatches(blocks, '')).toEqual([]);
  });

  it('replaces one', () => {
    const [m] = findMatches(blocks, 'cat');
    const next = replaceOne(chapter, m!, 'dog');
    expect((next.blocks[0] as { text: string }).text).toBe('The dog and the Cat.');
  });

  it('replaces all with differing lengths', () => {
    const r = replaceAll(chapter, 'cat', 'tiger');
    expect(r.count).toBe(3);
    expect((r.chapter.blocks[0] as { text: string }).text).toBe('The tiger and the tiger.');
    expect((r.chapter.blocks[1] as { text: string }).text).toBe('tiger?');
  });
});
