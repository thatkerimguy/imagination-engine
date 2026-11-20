import { isUlid, type Block, type ChapterDocument } from '@kn/core';
import { describe, expect, it } from 'vitest';
import {
  createBlock,
  createModuleBlock,
  insertBlock,
  moveBlock,
  removeBlock,
  replaceBlock,
  toggleBeatStop,
} from './chapter-ops.ts';

const prose = (id: string, text = id): Block => ({ id, kind: 'prose', text });
const chapter = (...ids: string[]): ChapterDocument => ({
  id: 'c1',
  seasonId: 's1',
  title: 'T',
  status: 'draft',
  blocks: ids.map((i) => prose(i)),
});
const ids = (c: ChapterDocument) => c.blocks.map((b) => b.id);

describe('createBlock', () => {
  it('produces ULID ids and the right shapes', () => {
    for (const kind of ['prose', 'dialogue', 'scene-break'] as const) {
      const b = createBlock(kind);
      expect(isUlid(b.id)).toBe(true);
      expect(b.kind).toBe(kind);
    }
    expect(createBlock('dialogue')).toMatchObject({ speaker: '', text: '' });
    expect(isUlid(createModuleBlock('m', 1, { a: 1 }).id)).toBe(true);
  });
});

describe('insertBlock', () => {
  it('inserts after an id, appends on null or unknown id', () => {
    const c = chapter('a', 'b');
    expect(ids(insertBlock(c, prose('x'), 'a'))).toEqual(['a', 'x', 'b']);
    expect(ids(insertBlock(c, prose('x'), 'b'))).toEqual(['a', 'b', 'x']);
    expect(ids(insertBlock(c, prose('x'), null))).toEqual(['a', 'b', 'x']);
    expect(ids(insertBlock(c, prose('x'), 'nope'))).toEqual(['a', 'b', 'x']);
  });
});

describe('replace / move / remove', () => {
  it('replaceBlock swaps by id and ignores unknown ids', () => {
    const c = chapter('a', 'b');
    expect(replaceBlock(c, prose('b', 'new')).blocks[1]).toEqual(prose('b', 'new'));
    expect(replaceBlock(c, prose('zz'))).toBe(c);
  });

  it('moveBlock swaps and respects bounds', () => {
    const c = chapter('a', 'b', 'c');
    expect(ids(moveBlock(c, 'b', -1))).toEqual(['b', 'a', 'c']);
    expect(ids(moveBlock(c, 'b', 1))).toEqual(['a', 'c', 'b']);
    expect(moveBlock(c, 'a', -1)).toBe(c);
    expect(moveBlock(c, 'c', 1)).toBe(c);
    expect(moveBlock(c, 'zz', 1)).toBe(c);
  });

  it('removeBlock removes or returns the same chapter', () => {
    const c = chapter('a', 'b');
    expect(ids(removeBlock(c, 'a'))).toEqual(['b']);
    expect(removeBlock(c, 'zz')).toBe(c);
  });
});

describe('toggleBeatStop', () => {
  it('adds then removes the beatStop key', () => {
    const c = chapter('a');
    const on = toggleBeatStop(c, 'a');
    expect(on.blocks[0]).toMatchObject({ beatStop: true });
    const off = toggleBeatStop(on, 'a');
    expect('beatStop' in off.blocks[0]!).toBe(false);
    expect(toggleBeatStop(c, 'zz')).toBe(c);
  });
});

describe('immutability', () => {
  it('never mutates the original chapter', () => {
    const c = chapter('a', 'b');
    const snapshot = structuredClone(c);
    insertBlock(c, prose('x'), 'a');
    replaceBlock(c, prose('a', 'changed'));
    moveBlock(c, 'a', 1);
    removeBlock(c, 'a');
    toggleBeatStop(c, 'a');
    expect(c).toEqual(snapshot);
  });
});
