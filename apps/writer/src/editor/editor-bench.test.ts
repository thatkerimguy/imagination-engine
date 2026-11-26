// Deterministic perf gates: a 100-block (~4,500 word) chapter must analyse, parse and index fast,
// and a 10,000-word chapter keystroke (edit + live metrics) must fit well inside one frame.
import type { Block, ChapterDocument } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '../analysis/realtime.ts';
import { buildSearchIndex } from '../search/search-index.ts';
import { replaceBlock } from '../store/chapter-ops.ts';
import { inlineRuns } from './inline-markup.ts';
import { applyRunEdit, blocksToSegments } from './prose-runs.ts';

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

// DIRECTIVE-06 D3: a 10,000-word / 250-block chapter. One keystroke = replace one block + the
// live-metrics recompute (per-block stats cache: only the edited block is re-tokenised).
const FRAME_MS = 16;

function longChapter(): ChapterDocument {
  let w = 0;
  const sentence = (n: number): string => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(WORDS[w++ % WORDS.length] ?? 'the');
    return `${out.join(' ')}.`;
  };
  const blocks: Block[] = [];
  for (let i = 0; i < 250; i++) {
    const text = `${sentence(20)} ${sentence(12)} ${sentence(8)}`; // 40 words
    blocks.push(
      i % 5 === 4
        ? { id: `l${i}`, kind: 'dialogue', speaker: 'Mara', text }
        : { id: `l${i}`, kind: 'prose', text },
    );
  }
  return { id: 'long', title: 'Long', blocks } as unknown as ChapterDocument;
}

describe('editor bench: 250 blocks / 10,000 words', () => {
  const doc = longChapter();

  it('has the expected size', () => {
    expect(doc.blocks).toHaveLength(250);
    expect(analyzeDocument(doc.blocks).words).toBeGreaterThanOrEqual(10_000);
  });

  it(`single-block edit + live metrics update < ${FRAME_MS} ms`, () => {
    let current = doc;
    let typed = 0;
    const keystroke = (): number => {
      const target = current.blocks[125] as Extract<Block, { kind: 'prose' }>;
      current = replaceBlock(current, { ...target, text: `${target.text} k${typed++}` });
      return analyzeDocument(current.blocks).words;
    };
    const ms = time(keystroke);
    expect(ms).toBeLessThan(FRAME_MS);
    // Incremental counts stay exact: the same as a cold analysis of fresh block objects.
    const cold = analyzeDocument(current.blocks.map((b) => ({ ...b })));
    expect(analyzeDocument(current.blocks)).toEqual(cold);
    console.info(`[bench] 10k-word keystroke: ${ms.toFixed(2)} ms`);
  });
});

// OVERHAUL-02: one keystroke in a continuous prose run = rebuild that run's blocks + regroup the
// whole 10,000-word chapter into segments (what UnifiedBlocks does per render).
describe('unified editor bench: 10,000-word prose-run keystroke', () => {
  const doc = longChapter();
  it(`run edit + re-segmentation < ${FRAME_MS} ms`, () => {
    const segs = blocksToSegments(doc.blocks, { includeCues: true });
    const run = segs.find((s) => s.kind === 'prose-run' && s.blockIds.length > 1);
    if (!run || run.kind !== 'prose-run') throw new Error('no run');
    let n = 0;
    const ms = time(() => {
      const next = applyRunEdit(doc.blocks, run, `${run.markdown}${'x'.repeat(++n)}`);
      return blocksToSegments(next, { includeCues: true }).length;
    });
    console.info(`[bench] unified run keystroke: ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThan(FRAME_MS);
  });
});
