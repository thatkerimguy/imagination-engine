import type { Block } from '@kn/core';
import { describe, expect, it } from 'vitest';
import {
  applyRunEdit,
  blocksToSegments,
  locateInRun,
  paragraphStarts,
  runToBlocks,
  segmentsToBlocks,
  type EditorSegment,
} from './prose-runs.ts';

const p = (id: string, text: string, extra: Partial<Block> = {}): Block =>
  ({ id, kind: 'prose', text, ...extra }) as Block;
const dlg: Block = { id: 'd1', kind: 'dialogue', speaker: 'Mira', text: 'Run.' };
const brk: Block = { id: 's1', kind: 'scene-break' };
const cue: Block = {
  id: 'm1',
  kind: 'module',
  moduleId: 'bl-dice-3d',
  moduleVersion: '1.0.0',
  settings: {},
} as unknown as Block;

let n = 0;
const ids = (): string => `new${++n}`;
const all = { includeCues: true };
const run = (segs: EditorSegment[], i: number) => {
  const s = segs[i]!;
  if (s.kind !== 'prose-run') throw new Error('not a run');
  return s;
};

describe('blocksToSegments', () => {
  const blocks = [
    p('a', '**Bold** start'),
    p('b', '*soft* ~~gone~~'),
    dlg,
    p('c', '# Heading'),
    brk,
  ];
  it('merges adjacent prose into one run joined by a blank line', () => {
    const segs = blocksToSegments(blocks, all);
    expect(segs.map((s) => s.kind)).toEqual(['prose-run', 'dialogue', 'prose-run', 'scene-break']);
    expect(run(segs, 0)).toEqual({
      kind: 'prose-run',
      id: 'a',
      blockIds: ['a', 'b'],
      markdown: '**Bold** start\n\n*soft* ~~gone~~',
    });
  });
  it('round-trips losslessly, inline formatting and headings included', () => {
    expect(segmentsToBlocks(blocksToSegments(blocks, all), blocks)).toEqual(blocks);
  });
  it('keeps standalone and beat-stop blocks out of the merge', () => {
    const b = [p('a', 'one'), p('b', 'two', { beatStop: true }), p('c', 'three'), p('d', 'x\n\ny')];
    const segs = blocksToSegments(b, { ...all, standalone: (x) => x.id === 'c' });
    expect(segs.map((s) => (s.kind === 'prose-run' ? s.blockIds : s.id))).toEqual([
      ['a', 'b'],
      ['c'],
      ['d'],
    ]);
    expect(segmentsToBlocks(segs, b)).toEqual(b);
  });
});

describe('editing a run', () => {
  const prev = [p('a', 'one'), p('b', 'two'), p('c', 'three')] as never[];
  it('inserting a paragraph keeps the ids on both sides', () => {
    const out = runToBlocks('one\n\nnew\n\ntwo\n\nthree', prev, ids);
    expect(out.map((b) => b.id)).toEqual(['a', expect.stringMatching(/^new/), 'b', 'c']);
  });
  it('deleting a paragraph drops only that block', () => {
    expect(runToBlocks('one\n\nthree', prev, ids).map((b) => b.id)).toEqual(['a', 'c']);
  });
  it('editing in place keeps the id and other fields', () => {
    const styled = [p('a', 'one', { style: 'whisper' })] as never[];
    expect(runToBlocks('one!', styled, ids)).toEqual([p('a', 'one!', { style: 'whisper' })]);
  });
  it('splitting with a blank line creates the next paragraph', () => {
    expect(runToBlocks('one\n\n', [p('a', 'one')] as never[], ids).map((b) => b.text)).toEqual([
      'one',
      '',
    ]);
  });
  it('applyRunEdit replaces the run in place, dialogue and breaks untouched', () => {
    const blocks = [p('a', 'one'), p('b', 'two'), dlg, brk];
    const out = applyRunEdit(blocks, { blockIds: ['a', 'b'] }, 'one\n\ntwo and more', ids);
    expect(out).toEqual([p('a', 'one'), p('b', 'two and more'), dlg, brk]);
  });
  it('a single run is replaced whole, never split', () => {
    const blocks = [p('d', 'x\n\ny'), dlg];
    expect(applyRunEdit(blocks, { blockIds: ['d'], single: true }, 'x\n\nyz', ids)).toEqual([
      p('d', 'x\n\nyz'),
      dlg,
    ]);
  });
});

describe('cues hidden in prose mode', () => {
  const blocks = [p('a', 'one'), cue, p('b', 'two'), dlg, p('c', 'three')];
  it('hides cues, lets prose flow over them, and restores them on the way back', () => {
    const segs = blocksToSegments(blocks, { includeCues: false });
    expect(segs.map((s) => s.kind)).toEqual(['prose-run', 'dialogue', 'prose-run']);
    expect(run(segs, 0)).toMatchObject({ blockIds: ['a', 'b'], markdown: 'one\n\ntwo' });
    expect(segmentsToBlocks(segs, blocks)).toEqual(blocks);
  });
  it('a paragraph typed after the cue anchor stays before the cue', () => {
    const segs = blocksToSegments(blocks, { includeCues: false });
    const edited = segs.map((s) =>
      s.kind === 'prose-run' && s.id === 'a' ? { ...s, markdown: 'one\n\nzero\n\ntwo' } : s,
    );
    const out = segmentsToBlocks(edited, blocks, ids);
    expect(out.map((b) => b.id)).toEqual([
      'a',
      expect.stringMatching(/^new/),
      'm1',
      'b',
      'd1',
      'c',
    ]);
  });
  it('deleting the cue anchor paragraph keeps the cue (never dropped)', () => {
    const segs = blocksToSegments(blocks, { includeCues: false });
    const edited = segs.map((s) =>
      s.kind === 'prose-run' && s.id === 'a' ? { ...s, markdown: 'two' } : s,
    );
    const out = segmentsToBlocks(edited, blocks, ids);
    expect(out.filter((b) => b.kind === 'module')).toEqual([cue]);
    expect(out.map((b) => b.id)).toEqual(['m1', 'b', 'd1', 'c']);
  });
  it('a live run edit (applyRunEdit) keeps a hidden cue after its paragraph', () => {
    const r = run(blocksToSegments(blocks, { includeCues: false }), 0);
    const out = applyRunEdit(blocks, r, 'one!\n\ntwo', ids);
    expect(out.map((b) => b.id)).toEqual(['a', 'm1', 'b', 'd1', 'c']);
    expect(out[0]).toEqual(p('a', 'one!'));
  });
  it('a cue whose anchor was deleted lands at the start', () => {
    const b = [p('a', 'one'), cue];
    const segs = blocksToSegments(b, { includeCues: false }).filter(() => false);
    expect(segmentsToBlocks(segs, b)).toEqual([cue]);
  });
});

describe('run offsets', () => {
  it('maps run offsets to paragraphs', () => {
    const md = 'ab\n\ncd\n\nef';
    expect(paragraphStarts(md)).toEqual([0, 4, 8]);
    expect(locateInRun(md, 1)).toEqual({ index: 0, local: 1 });
    expect(locateInRun(md, 2)).toEqual({ index: 0, local: 2 });
    expect(locateInRun(md, 5)).toEqual({ index: 1, local: 1 });
    expect(locateInRun(md, 10)).toEqual({ index: 2, local: 2 });
  });
});
