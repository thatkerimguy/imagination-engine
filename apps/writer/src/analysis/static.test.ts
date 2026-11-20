import type { Block } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { extractInfo, wordFrequency } from './static.ts';

const blocks = (...texts: string[]): Block[] =>
  texts.map((text, i) => ({ id: `b${i}`, kind: 'prose', text }) as Block);

describe('wordFrequency', () => {
  const b = blocks('The cat and the dog. The cat ran home.');
  it('sorts descending and filters', () => {
    expect(wordFrequency(b, { filter: 'all', minLength: 1 })[0]).toEqual({ word: 'the', count: 3 });
    expect(wordFrequency(b, { filter: 'content', minLength: 1 })[0]).toEqual({
      word: 'cat',
      count: 2,
    });
    expect(wordFrequency(b, { filter: 'grammar', minLength: 1 }).map((w) => w.word)).toEqual([
      'the',
      'and',
    ]);
    expect(wordFrequency(b, { filter: 'all', minLength: 4, limit: 1 })).toEqual([
      { word: 'home', count: 1 },
    ]);
  });
});

describe('extractInfo', () => {
  const info = extractInfo(
    blocks(
      'Mail me at mara@example.com or see https://example.com/a?b=1, then (http://x.org/y). Tag #snake_eyes #snake_eyes.',
      'Call +1 555 123 4567 or 020-7946-0958. She said "Double or nothing." and “Boxcars!” Year 2024 is not a phone.',
      `${'word '.repeat(26)}end.`,
    ),
  );
  it('extracts emails, urls, hashtags', () => {
    expect(info.emails).toEqual(['mara@example.com']);
    expect(info.urls).toEqual(['https://example.com/a?b=1', 'http://x.org/y']);
    expect(info.hashtags).toEqual(['#snake_eyes']);
  });
  it('extracts phones, quotes, long sentences', () => {
    expect(info.phones).toEqual(['+1 555 123 4567', '020-7946-0958']);
    expect(info.quotes).toEqual(['Double or nothing.', 'Boxcars!']);
    expect(info.longSentences).toHaveLength(1);
  });
});
