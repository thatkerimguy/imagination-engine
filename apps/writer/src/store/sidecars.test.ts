import type { ChapterDocument } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { createMemoryDatabase } from '../db/memory-driver.ts';
import { applyRawText, captureRawText, pruneStyles, setBlockStyle } from './chapter-styles.ts';
import {
  appendPoint,
  dailyRollup,
  dayKeyOf,
  periodDelta,
  recordGrowth,
  loadGrowth,
  resetGrowthThrottle,
  seriesForRange,
} from './growth-store.ts';
import { createDoc } from './folders.ts';
import { NovelRepository } from './repository.ts';
import {
  DEFAULT_WRITER_PREFS,
  loadWriterPrefs,
  normalizeWriterPrefs,
  saveWriterPrefs,
  TOOL_IDS,
} from './writer-prefs.ts';

const A = '01M7WD7TG0SRH8FFJAF28FHTHC';
const B = '01M7WD7TG1R63M5MJ69NG6995F';
const repo = (): NovelRepository => new NovelRepository(createMemoryDatabase());

describe('writer prefs', () => {
  it('migrates the Phase 2 appearance setting', async () => {
    const r = repo();
    await r.docs.write('setting/app', { appearance: 'light', readerUrl: 'x' });
    expect((await loadWriterPrefs(r)).themeId).toBe('editorial-teal-light');
    await saveWriterPrefs(r, { themeId: 'warm-sepia', fontSize: 99 });
    const p = await loadWriterPrefs(r);
    expect([p.themeId, p.fontSize]).toEqual(['warm-sepia', 28]);
  });

  it('normalizes junk and appends new toolbar tools', () => {
    const p = normalizeWriterPrefs({
      themeId: 'nope',
      toolbarOrder: ['bold', 'zzz'],
      visibleMetrics: 3,
    });
    expect(p.themeId).toBe('system');
    expect(p.toolbarOrder[0]).toBe('bold');
    expect(p.toolbarOrder).toHaveLength(TOOL_IDS.length);
    expect(p.visibleMetrics).toEqual(DEFAULT_WRITER_PREFS.visibleMetrics);
  });
});

describe('chapter styles', () => {
  const chapter: ChapterDocument = {
    id: 'ch',
    seasonId: 's',
    title: 'T',
    status: 'draft',
    blocks: [
      { id: A, kind: 'prose', text: 'Hi {fg:#FF0000}red{/fg}' },
      { id: B, kind: 'prose', text: 'plain' },
    ],
  };

  it('sets, clears and prunes block styles', () => {
    let s = setBlockStyle({}, A, { align: 'center', heading: 2 });
    expect(s[A]).toEqual({ align: 'center', heading: 2 });
    s = setBlockStyle(s, A, { align: undefined, heading: undefined });
    expect(s).toEqual({});
    s = setBlockStyle(s, 'gone', { quote: true });
    expect(pruneStyles(s, [A])).toEqual({});
  });

  it('round-trips writer-only source text through the sidecar', () => {
    const styles = captureRawText(chapter, {});
    expect(styles).toEqual({ [A]: { raw: 'Hi {fg:#FF0000}red{/fg}' } });
    const stored = {
      ...chapter,
      blocks: [{ id: A, kind: 'prose', text: 'Hi red' }, chapter.blocks[1]!],
    };
    expect(applyRawText(stored as ChapterDocument, styles)).toEqual(chapter);
    const editedElsewhere = { ...stored, blocks: [{ id: A, kind: 'prose', text: 'Changed' }] };
    expect(applyRawText(editedElsewhere as ChapterDocument, styles).blocks[0]).toMatchObject({
      text: 'Changed',
    });
  });
});

describe('growth store', () => {
  const c = (words: number) => ({ chars: words * 5, words, sentences: 1, paragraphs: 1 });
  const t0 = new Date(2026, 10, 20, 10, 0).getTime();

  it('throttles to one point per 5 minutes and rolls up by day', () => {
    let s = appendPoint({ points: [] }, c(10), t0);
    s = appendPoint(s, c(20), t0 + 60_000);
    expect(s.points).toHaveLength(1);
    expect(s.points[0]!.words).toBe(20);
    s = appendPoint(s, c(30), t0 + 6 * 60_000);
    s = appendPoint(s, c(50), t0 + 24 * 3600_000);
    expect(s.points).toHaveLength(3);
    expect(dailyRollup(s.points).map((p) => p.words)).toEqual([30, 50]);
    expect(seriesForRange(s.points, 'today', t0 + 24 * 3600_000)).toHaveLength(1);
    expect(periodDelta(seriesForRange(s.points, '7d', t0 + 24 * 3600_000)).words).toBe(20);
    expect(dayKeyOf(t0)).toBe('2026-11-20');
  });

  it('skips storage writes inside the throttle window unless forced', async () => {
    resetGrowthThrottle();
    const r = repo();
    const { id } = await createDoc(r, null, { title: 'x' });
    expect(await recordGrowth(r, `doc:${id}`, c(1), { now: t0 })).toBe(true);
    expect(await recordGrowth(r, `doc:${id}`, c(2), { now: t0 + 1000 })).toBe(false);
    expect(await recordGrowth(r, `doc:${id}`, c(3), { now: t0 + 2000, force: true })).toBe(true);
    expect((await loadGrowth(r, `doc:${id}`)).points.map((p) => p.words)).toEqual([3]);
    expect(await recordGrowth(r, 'chapter:missing', c(1), { force: true })).toBe(false);
  });
});
