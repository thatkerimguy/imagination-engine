import { describe, expect, it } from 'vitest';
import { dayKeyOf, type GrowthPoint } from '../store/growth-store.ts';
import {
  buildWidgetPayload,
  REDACTED_HEADLINE,
  REDACTED_SUBLINE,
  REDACTED_WORDS,
  todayWordsFrom,
  type RecentChapter,
} from './widget-state.ts';

const recent: RecentChapter = {
  novelId: 'n1',
  seasonId: 's1',
  chapterId: 'c 1',
  novelTitle: 'The Secret Manuscript',
  chapterTitle: 'Chapter One: Blood Oath',
};

const leaks = (p: object): boolean => /Secret|Blood|n1|s1|c%201/.test(JSON.stringify(p));

describe('buildWidgetPayload', () => {
  it('shows titles, words and a chapter deep link when unlocked', () => {
    const p = buildWidgetPayload({ lockEnabled: false, recent, todayWords: 1234 });
    expect(p).toEqual({
      headline: 'Chapter One: Blood Oath',
      subline: 'The Secret Manuscript',
      todayWordsLabel: '1234 words today',
      deepLinkUri: 'kinetic-writer://novel/n1/chapter/s1/c%201',
      redacted: false,
    });
  });

  it('redacts everything while Master Lock is on', () => {
    const p = buildWidgetPayload({ lockEnabled: true, recent, todayWords: 900 });
    expect(p).toEqual({
      headline: REDACTED_HEADLINE,
      subline: REDACTED_SUBLINE,
      todayWordsLabel: REDACTED_WORDS,
      deepLinkUri: 'kinetic-writer://',
      redacted: true,
    });
    expect(leaks(p)).toBe(false);
    expect(p.todayWordsLabel).not.toMatch(/\d/);
  });

  it('redacts when the novel or chapter has its own item lock', () => {
    const p = buildWidgetPayload({ lockEnabled: false, itemLocked: true, recent, todayWords: 5 });
    expect(p.redacted).toBe(true);
    expect(leaks(p)).toBe(false);
  });

  it('falls back to a start prompt with no recent chapter', () => {
    const p = buildWidgetPayload({ lockEnabled: false, recent: null, todayWords: 1 });
    expect(p.headline).toBe(REDACTED_HEADLINE);
    expect(p.todayWordsLabel).toBe('1 word today');
    expect(p.deepLinkUri).toBe('kinetic-writer://');
  });

  it('clips long titles and uses the locale formatter', () => {
    const p = buildWidgetPayload({
      lockEnabled: false,
      recent: { ...recent, chapterTitle: 'x'.repeat(80) },
      todayWords: 12345.4,
      formatNumber: (n) => n.toLocaleString('en-US'),
    });
    expect(p.headline.length).toBe(40);
    expect(p.headline.endsWith('…')).toBe(true);
    expect(p.todayWordsLabel).toBe('12,345 words today');
  });
});

describe('todayWordsFrom', () => {
  const now = new Date(2026, 10, 26, 15).getTime();
  const at = (daysAgo: number, words: number): GrowthPoint => {
    const ts = now - daysAgo * 86_400_000;
    return { dayKey: dayKeyOf(ts), ts, words, chars: 0, sentences: 0, paragraphs: 0 };
  };

  it('is today minus the last snapshot before today', () => {
    expect(todayWordsFrom([at(3, 100), at(1, 400), at(0, 520), at(0, 650)], now)).toBe(250);
  });
  it('counts everything when the series starts today', () => {
    expect(todayWordsFrom([at(0, 80)], now)).toBe(80);
  });
  it('is 0 with nothing written today or on net deletion', () => {
    expect(todayWordsFrom([at(2, 300)], now)).toBe(0);
    expect(todayWordsFrom([at(1, 300), at(0, 200)], now)).toBe(0);
    expect(todayWordsFrom([], now)).toBe(0);
  });
});

describe('todayWordsFrom with day-0 baselines (Gate 3 Bug 3)', () => {
  const now = new Date(2026, 10, 26, 15).getTime();
  const point = (minutes: number, words: number, baseline = false): GrowthPoint => ({
    dayKey: dayKeyOf(now),
    ts: now - 60 * 60_000 + minutes * 60_000,
    words,
    chars: 0,
    sentences: 0,
    paragraphs: 0,
    ...(baseline ? { baseline: true } : {}),
  });

  it('3 words typed into a 118-word chapter created today → "3 words today"', () => {
    const words = todayWordsFrom([point(0, 118, true), point(5, 121)], now);
    expect(words).toBe(3);
    const label = buildWidgetPayload({ lockEnabled: false, recent: null, todayWords: words });
    expect(label.todayWordsLabel).toBe('3 words today');
  });

  it('a baseline with no edits yet reports 0, not the chapter length', () => {
    expect(todayWordsFrom([point(0, 118, true)], now)).toBe(0);
  });
});
