// Gate 3 Bug 3 regression: the widget's "words today" must count words actually typed today,
// not the starting length of a chapter created, imported or restored today.
import { ulid, type ChapterDocument } from '@kn/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDatabase } from '../db/memory-driver.ts';
import { demoBundle, DEMO_NOVEL_ID } from './demo.ts';
import { countsOf, logChapterGrowth } from './growth-logger.ts';
import { loadGrowth, resetGrowthThrottle, todayWordsForBook } from './growth-store.ts';
import { addChapter } from './outline.ts';
import { NovelRepository } from './repository.ts';
import { moveToTrash, restoreTrashedItem } from './trash.ts';

const NOW = new Date(2026, 10, 26, 15).getTime();

function prose(words: number, from = 0): ChapterDocument['blocks'][number] {
  const text = Array.from({ length: words }, (_, i) => `w${from + i}`).join(' ');
  return { id: ulid(NOW + from), kind: 'prose', text };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  resetGrowthThrottle();
});
afterEach(() => vi.useRealTimers());

const repo = (): NovelRepository => new NovelRepository(createMemoryDatabase(), () => Date.now());

describe('day-0 growth baseline', () => {
  it('typing 3 words into a 118-word chapter created today reports 3 words today', async () => {
    const r = repo();
    const novel = await r.createNovel({ title: 'T', author: 'A', sectionLabel: 'Season' });
    const seasonId = novel.seasons[0]!;
    const ch = await addChapter(r, novel.id, seasonId, 'Imported');
    const start = { ...ch, blocks: [prose(118)] };
    // An import writes the full text on its first save: that is a baseline, not writing.
    const fresh = await r.saveChapter(novel.id, { ...start, id: 'fresh-import' });
    expect(fresh.chapter.blocks).toHaveLength(1);
    expect(await todayWordsForBook(r, novel.id, NOW)).toBe(0);
    vi.setSystemTime(NOW + 60_000);
    const typed = { ...fresh.chapter, blocks: [prose(118), prose(3, 500)] };
    await r.saveChapter(novel.id, typed);
    await logChapterGrowth(r, novel.id, typed, true);
    expect(countsOf(typed).words).toBe(121);
    expect(await todayWordsForBook(r, novel.id, NOW + 60_000)).toBe(3);
  });

  it('seeding the 118-word-plus demo book counts 0 words today', async () => {
    const r = repo();
    await r.importBundle(demoBundle());
    expect(await todayWordsForBook(r, DEMO_NOVEL_ID, NOW)).toBe(0);
    const baseline = (await loadGrowth(r, `novel:${DEMO_NOVEL_ID}`)).points;
    expect(baseline).toHaveLength(1);
    expect(baseline[0]).toMatchObject({ baseline: true });
    expect(baseline[0]!.words).toBeGreaterThan(100);
  });

  it('restoring a trashed chapter re-baselines it instead of counting it as written', async () => {
    const r = repo();
    const novel = await r.createNovel({ title: 'T', author: 'A', sectionLabel: 'Season' });
    const seasonId = novel.seasons[0]!;
    const ch = await addChapter(r, novel.id, seasonId, 'Two');
    vi.setSystemTime(NOW - 86_400_000); // yesterday: 50 words written and logged
    const written = { ...ch, blocks: [prose(50)] };
    await r.saveChapter(novel.id, written);
    await logChapterGrowth(r, novel.id, written, true);
    vi.setSystemTime(NOW);
    await moveToTrash(r, { kind: 'chapter', novelId: novel.id, seasonId, chapterId: ch.id });
    await restoreTrashedItem(r, ch.id);
    expect(await todayWordsForBook(r, novel.id, NOW)).toBe(0);
  });
});
