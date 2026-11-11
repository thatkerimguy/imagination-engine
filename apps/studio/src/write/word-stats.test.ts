import type { Block } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { countWords, wordStats } from './word-stats.ts';

const text = (en: string, tr = '') => ({ id: 'txt_1', en, tr });

describe('countWords', () => {
  it('counts words, not punctuation or spaces', () => {
    expect(countWords('  The rain — it never stops.  ', 'en')).toBe(5);
    expect(countWords('', 'en')).toBe(0);
  });

  it('counts a name or a variable as one word and looks inside effect tags', () => {
    expect(countWords('{@mira} found [shake]the old key[/shake].', 'en')).toBe(5);
  });

  it('counts Turkish words with suffixes as one word', () => {
    expect(countWords('Yağmur hiç dinmiyordu, İstanbul’da.', 'tr')).toBe(4);
  });

  it('falls back to plain words when the markup is broken', () => {
    expect(countWords('an {open brace', 'en')).toBe(3);
  });
});

describe('wordStats', () => {
  it('adds lines, choices and nested branches in one language', () => {
    const blocks = [
      { id: 'blk_1', type: 'narration', text: text('One two three.', 'Bir iki') },
      {
        id: 'blk_2',
        type: 'choice',
        options: [
          {
            id: 'opt_1',
            text: text('Go left'),
            then: [{ id: 'blk_3', type: 'narration', text: text('Four five') }],
          },
        ],
      },
    ] as unknown as Block[];
    expect(wordStats(blocks, 'en')).toEqual({ words: 7, minutes: 1 });
    expect(wordStats(blocks, 'tr')).toEqual({ words: 2, minutes: 1 });
    expect(wordStats([], 'en')).toEqual({ words: 0, minutes: 0 });
  });
});
