import type { Block, ChapterDocument } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { cleanBlock, isBlockComplete, prepareChapter } from './sanitize.ts';

const A = '01M7WD7TG0SRH8FFJAF28FHTHC';
const B = '01M7WD7TG1R63M5MJ69NG6995F';

describe('isBlockComplete', () => {
  it('requires prose text and dialogue speaker + text', () => {
    expect(isBlockComplete({ id: A, kind: 'prose', text: ' ' })).toBe(false);
    expect(isBlockComplete({ id: A, kind: 'prose', text: 'x' })).toBe(true);
    expect(isBlockComplete({ id: A, kind: 'dialogue', speaker: '', text: 'x' })).toBe(false);
    expect(isBlockComplete({ id: A, kind: 'dialogue', speaker: 'M', text: '' })).toBe(false);
    expect(isBlockComplete({ id: A, kind: 'dialogue', speaker: 'M', text: 'x' })).toBe(true);
    expect(isBlockComplete({ id: A, kind: 'scene-break' })).toBe(true);
  });
});

describe('cleanBlock', () => {
  it("drops style 'body' but keeps other styles", () => {
    expect(cleanBlock({ id: A, kind: 'prose', text: 'x', style: 'body' })).toEqual({
      id: A,
      kind: 'prose',
      text: 'x',
    });
    const styled: Block = { id: A, kind: 'prose', text: 'x', style: 'whisper' };
    expect(cleanBlock(styled)).toEqual(styled);
  });

  it('drops invalid accent colours, keeps valid ones', () => {
    const base = { id: A, kind: 'dialogue', speaker: 'M', text: 'x' } as const;
    expect(cleanBlock({ ...base, accentColor: '#12' })).toEqual(base);
    expect(cleanBlock({ ...base, accentColor: '#aabbcc' })).toEqual({
      ...base,
      accentColor: '#aabbcc',
    });
  });

  it('drops blank scene-break label and timestamp', () => {
    expect(cleanBlock({ id: A, kind: 'scene-break', label: ' ', timestamp: '' })).toEqual({
      id: A,
      kind: 'scene-break',
    });
    expect(cleanBlock({ id: A, kind: 'scene-break', label: 'L' })).toMatchObject({ label: 'L' });
  });
});

describe('prepareChapter', () => {
  const base: ChapterDocument = {
    id: 'c1',
    seasonId: 's1',
    title: 'T',
    status: 'draft',
    blocks: [],
  };

  it('returns ok with skipped ids', () => {
    const res = prepareChapter({
      ...base,
      blocks: [
        { id: A, kind: 'prose', text: '' },
        { id: B, kind: 'prose', text: 'hi' },
      ],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.skipped).toEqual([A]);
      expect(res.chapter.blocks.map((b) => b.id)).toEqual([B]);
    }
  });

  it('returns errors for an invalid chapter', () => {
    const res = prepareChapter({ ...base, title: '' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.length).toBeGreaterThan(0);
  });
});
