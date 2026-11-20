import { readFileSync } from 'node:fs';
import type { Block } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { analyzeDocument, createTypingMeter } from './realtime.ts';
import { mattr } from './text-lexical.ts';
import { splitSentences } from './text-split.ts';

const chapter = JSON.parse(
  readFileSync(
    new URL('../../../../sample-novels/vertical-slice/seasons/s01/ch01.json', import.meta.url),
    'utf8',
  ),
) as { blocks: Block[] };

const prose = (text: string, i = 0): Block => ({ id: `b${i}`, kind: 'prose', text }) as Block;

describe('Snake Eyes golden values', () => {
  const m = analyzeDocument(chapter.blocks);
  it('counts', () => {
    expect(m.chars).toBe(653);
    expect(m.charsNoSpaces).toBe(531);
    expect(m.words).toBe(118);
    expect(m.sentences).toBe(15);
    expect(m.paragraphs).toBe(6);
    expect(m.uniqueWords).toBe(87);
  });
  it('percentages and readability', () => {
    expect(m.uniquePct).toBeCloseTo(73.7, 1);
    expect(m.lexicalDensity).toBeCloseTo(49.2, 1);
    expect(m.mattr).toBeCloseTo(85.8, 1);
    expect(m.fleschEase).toBeCloseTo(86.3, 1);
    expect(m.dialogueShare).toBeCloseTo(10.2, 1);
    expect(m.smogIsEstimate).toBe(true);
  });
  it('includeChat adds the cyberbrain lines', () => {
    expect(analyzeDocument(chapter.blocks, { includeChat: true }).paragraphs).toBe(9);
  });
});

describe('analyzeDocument edge cases', () => {
  it('returns zeros, not NaN, for empty documents', () => {
    const m = analyzeDocument([]);
    for (const v of Object.values(m)) expect(Number.isNaN(v)).toBe(false);
    expect(m.words).toBe(0);
    expect(m.fleschEase).toBe(0);
  });
  it('treats contractions and hyphenations as one word', () => {
    expect(analyzeDocument([prose("Don't be a well-known fool.")]).words).toBe(5);
  });
  it('strips inline markup and splits on blank lines', () => {
    const m = analyzeDocument([prose('**Hello** world.\n\nSecond one.')]);
    expect(m.paragraphs).toBe(2);
    expect(m.chars).toBe('Hello world.'.length + 2 + 'Second one.'.length);
  });
  it('counts unpunctuated text as a sentence', () => {
    expect(analyzeDocument([prose('no punctuation here')]).sentences).toBe(1);
  });
  it('protects abbreviations, decimals and ellipses: exactly 3 sentences', () => {
    const t =
      'Dr. Smith met Mrs. Jones at 3.14 p.m. on St. James St. today. It rained... a lot. Then e.g. the end.';
    expect(splitSentences(t)).toHaveLength(3);
    expect(analyzeDocument([prose(t)]).sentences).toBe(3);
  });
  it('passes typing speed through', () => {
    const m = analyzeDocument([], { typing: { cpm: 300, wpm: 60 } });
    expect([m.typingCpm, m.typingWpm]).toEqual([300, 60]);
  });
});

describe('MATTR', () => {
  const naive = (t: readonly string[], w: number): number => {
    if (t.length < w) return (new Set(t).size / t.length) * 100;
    let sum = 0;
    for (let i = 0; i + w <= t.length; i++) sum += new Set(t.slice(i, i + w)).size / w;
    return (sum / (t.length - w + 1)) * 100;
  };
  it('incremental equals the naive reference on random text', () => {
    let seed = 42;
    const rnd = (): number => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const tokens = Array.from({ length: 700 }, () => `w${Math.floor(rnd() * 90)}`);
    expect(mattr(tokens, 50)).toBeCloseTo(naive(tokens, 50), 9);
    expect(mattr(tokens.slice(0, 30), 50)).toBeCloseTo(naive(tokens.slice(0, 30), 50), 9);
  });
});

describe('createTypingMeter', () => {
  it('computes chars per active minute and ignores idle gaps and deletions', () => {
    const t = createTypingMeter();
    t.record(0, 0);
    t.record(50, 4_000); // 4 s active, +50 chars
    t.record(40, 6_000); // deletion: no negative
    expect(t.speed(6_000).cpm).toBeCloseTo((50 / 6_000) * 60_000, 5);
    t.record(140, 60_000); // idle gap (>5 s) adds chars but no time
    const s = t.speed(60_000);
    expect(s.cpm).toBeCloseTo((150 / 6_000) * 60_000, 5);
    expect(s.wpm).toBeCloseTo(s.cpm / 5, 5);
    t.reset();
    expect(t.speed(70_000)).toEqual({ cpm: 0, wpm: 0 });
  });
});

describe('performance', () => {
  it('analyzes 10,000 words in under 500 ms', () => {
    const sentence = "The quick brown fox, who isn't well-known, jumps over the lazy dog. ";
    const block = sentence.repeat(20); // 240 words
    const blocks = Array.from({ length: 42 }, (_, i) => prose(block, i));
    const t0 = performance.now();
    const m = analyzeDocument(blocks);
    const ms = performance.now() - t0;
    console.log(`analyzeDocument ${m.words} words: ${ms.toFixed(1)} ms`);
    expect(m.words).toBeGreaterThanOrEqual(10_000);
    expect(ms).toBeLessThan(500);
  });
});
