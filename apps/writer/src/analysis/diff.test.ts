import { describe, expect, it } from 'vitest';
import { blocksToLines, diffLines, diffStats, type Hunk } from './diff.ts';

const rebuild = (h: Hunk[], keep: 'equal' | 'insert' | 'delete'): string[] =>
  h.filter((x) => x.op === 'equal' || x.op === keep).flatMap((x) => x.lines);

describe('diffLines', () => {
  it('identical inputs return a single equal hunk', () => {
    expect(diffLines(['a', 'b'], ['a', 'b'])).toEqual([{ op: 'equal', lines: ['a', 'b'] }]);
    expect(diffLines([], [])).toEqual([]);
  });
  it('pure insert and pure delete', () => {
    expect(diffLines(['a', 'c'], ['a', 'b', 'c'])).toEqual([
      { op: 'equal', lines: ['a'] },
      { op: 'insert', lines: ['b'] },
      { op: 'equal', lines: ['c'] },
    ]);
    expect(diffLines(['a', 'b', 'c'], ['a', 'c'])).toEqual([
      { op: 'equal', lines: ['a'] },
      { op: 'delete', lines: ['b'] },
      { op: 'equal', lines: ['c'] },
    ]);
    expect(diffLines([], ['x'])).toEqual([{ op: 'insert', lines: ['x'] }]);
  });
  it('mixed edits reconstruct both sides', () => {
    const a = 'the quick brown fox jumps over the lazy dog'.split(' ');
    const b = 'a quick red fox leaps over the very lazy cat'.split(' ');
    const h = diffLines(a, b);
    expect(rebuild(h, 'insert')).toEqual(b);
    expect(rebuild(h, 'delete')).toEqual(a);
    const st = diffStats(h);
    expect(st.added).toBeGreaterThan(0);
    expect(st.removed).toBeGreaterThan(0);
  });
  it('handles a 2,000-line document with scattered edits quickly', () => {
    const a = Array.from({ length: 2000 }, (_, i) => `line ${i}`);
    const b = [...a];
    for (let i = 50; i < 2000; i += 97) b[i] = `edited ${i}`;
    b.splice(700, 0, 'new one', 'new two');
    b.splice(1500, 3);
    const t = performance.now();
    const h = diffLines(a, b);
    expect(performance.now() - t).toBeLessThan(100);
    expect(rebuild(h, 'insert')).toEqual(b);
    expect(rebuild(h, 'delete')).toEqual(a);
  });
});

describe('blocksToLines', () => {
  it('renders prose, dialogue and scene breaks without markup', () => {
    expect(
      blocksToLines([
        { kind: 'prose', text: 'Some **bold** text' },
        { kind: 'dialogue', speaker: 'Ada', text: 'Hello' },
        { kind: 'scene-break' },
      ]),
    ).toEqual(['Some bold text', 'Ada: Hello', '* * *']);
  });
});
