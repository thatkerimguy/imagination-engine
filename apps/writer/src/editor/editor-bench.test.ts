// Deterministic perf gate: a 100-block (~4,500 word) chapter must analyse, parse and index fast.
import type { Block } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '../analysis/realtime.ts';
import { buildSearchIndex } from '../search/search-index.ts';
import { inlineRuns } from './inline-markup.ts';

const BUDGET_MS = 50;
const WORDS = (
  'the harbour smelled of brine and old rope while Mara counted the lamps along the quay ' +
  'nobody spoke because the *tide* had turned and **every** window stayed dark'
).split(' ');

function chapter(): Block[] {
  let w = 0;
  const sentence = (n: number): string => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(WORDS[w++ % WORDS.length] ?? 'the');
    return `${out.join(' ')}.`;
  };
  const blocks: Block[] = [];
  for (let i = 0; i < 100; i++) {
    const text = `${sentence(20)} ${sentence(15)} ${sentence(10)}`; // 45 words
    blocks.push(
      i % 5 === 4
        ? { id: `b${i}`, kind: 'dialogue', speaker: 'Mara', text }
        : { id: `b${i}`, kind: 'prose', text },
    );
  }
  return blocks;
}

/** Median of 5 timed runs after one warm-up. */
function time(fn: () => unknown): number {
  fn();
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    fn();
    runs.push(performance.now() - t0);
  }
  return runs.sort((a, b) => a - b)[2] ?? Infinity;
}

const blocks = chapter();

describe('editor bench: 100 blocks / ~4,500 words', () => {
  it('has the expected size', () => {
    expect(blocks).toHaveLength(100);
    expect(analyzeDocument(blocks).words).toBeGreaterThan(4000);
  });

  it(`analyzeDocument < ${BUDGET_MS} ms`, () => {
    expect(time(() => analyzeDocument(blocks))).toBeLessThan(BUDGET_MS);
  });

  it(`inlineRuns over all blocks < ${BUDGET_MS} ms`, () => {
    const parse = (): number =>
      blocks.reduce((n, b) => n + ('text' in b ? inlineRuns(b.text).length : 0), 0);
    expect(time(parse)).toBeLessThan(BUDGET_MS);
  });

  it(`buildSearchIndex < ${BUDGET_MS} ms`, () => {
    const src = {
      novels: [{ id: 'n1', title: 'Bench' }],
      chapters: [
        { novelId: 'n1', novelTitle: 'Bench', seasonId: 's1', chapterId: 'c1', title: 'C', blocks },
      ],
      folders: [],
      docs: [],
      meta: new Map(),
    };
    expect(time(() => buildSearchIndex(src))).toBeLessThan(BUDGET_MS);
  });
});
