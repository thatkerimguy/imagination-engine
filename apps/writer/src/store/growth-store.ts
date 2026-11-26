// Writing-growth history (relational `growth_logs`): periodic snapshots of text counts per
// chapter, book, note or folder node, throttled to one stored point per 5 minutes, with daily
// rollups for the Growth charts. Create / import / restore record an `is_baseline` day-0 row so
// starting text never counts as words written today (Gate 3 Bug 3).
import { computeTodayWords, ulid } from '@kn/core';
import type { GrowthLogRow } from '../db/port.ts';
import { appendPoint, dayKeyOf, type GrowthCounts, type GrowthSeries } from './growth-series.ts';
import type { NovelRepository } from './repository.ts';

export * from './growth-series.ts';

export type GrowthTarget =
  `chapter:${string}` | `novel:${string}` | `doc:${string}` | `folder:${string}`;

export const GROWTH_THROTTLE_MS = 5 * 60 * 1000;
const MAX_POINTS = 5000;

/** The node a growth target points at (`chapter:<id>` → `<id>`). */
export const growthNodeId = (target: GrowthTarget): string => target.slice(target.indexOf(':') + 1);

const toSeries = (rows: readonly GrowthLogRow[]): GrowthSeries => ({
  points: rows.map((r) => ({
    dayKey: r.dateKey,
    ts: Date.parse(r.recordedAt),
    chars: r.chars,
    words: r.wordCount,
    sentences: r.sentences,
    paragraphs: r.paragraphs,
    ...(r.isBaseline ? { baseline: true } : {}),
  })),
});

export async function loadGrowth(
  repo: NovelRepository,
  target: GrowthTarget,
): Promise<GrowthSeries> {
  return toSeries(await repo.db.listGrowthLogs({ nodeId: growthNodeId(target) }));
}

function row(
  nodeId: string,
  bookId: string | null,
  counts: GrowthCounts,
  ts: number,
  isBaseline: boolean,
  id = ulid(ts),
): GrowthLogRow {
  return {
    id,
    nodeId,
    bookId,
    dateKey: dayKeyOf(ts),
    wordCount: counts.words,
    chars: counts.chars,
    sentences: counts.sentences,
    paragraphs: counts.paragraphs,
    isBaseline,
    recordedAt: new Date(ts).toISOString(),
  };
}

/** The node's book (`null` outside books), or `undefined` when the node does not exist. */
async function bookOf(repo: NovelRepository, nodeId: string): Promise<string | null | undefined> {
  const n = await repo.db.getNode(nodeId);
  if (!n) return undefined;
  return n.kind === 'book' ? n.id : n.bookId;
}

/** Last write time per node, so flushes inside the throttle window cost no storage I/O. */
const lastWrite = new Map<string, number>();

/**
 * Records a snapshot. Skips the write when the target was written less than 5 minutes ago,
 * unless `force` (e.g. when the editor closes). Inside the previous same-day snapshot's window
 * that row is updated in place (see `appendPoint`); a baseline row is never overwritten.
 * `counts` may be a function so the (costly) count only runs when a write will happen.
 */
export async function recordGrowth(
  repo: NovelRepository,
  target: GrowthTarget,
  counts: GrowthCounts | (() => GrowthCounts | Promise<GrowthCounts>),
  opts: { now?: number; force?: boolean } = {},
): Promise<boolean> {
  const now = opts.now ?? Date.now();
  const nodeId = growthNodeId(target);
  const prev = lastWrite.get(nodeId);
  if (!opts.force && prev !== undefined && now - prev < GROWTH_THROTTLE_MS) return false;
  const bookId = await bookOf(repo, nodeId);
  if (bookId === undefined) return false; // node gone (deleted while the editor flushed)
  lastWrite.set(nodeId, now);
  const value = typeof counts === 'function' ? await counts() : counts;
  const rows = await repo.db.listGrowthLogs({ nodeId });
  const last = rows.at(-1);
  const series = toSeries(last && !last.isBaseline ? [last] : []);
  const merged = appendPoint(series, value, now, GROWTH_THROTTLE_MS);
  const replace = last && !last.isBaseline && merged.points.length === 1;
  await repo.db.putGrowthLogs([
    replace
      ? row(nodeId, bookId, value, Date.parse(last.recordedAt), false, last.id)
      : row(nodeId, bookId, value, now, false),
  ]);
  if (!replace && rows.length >= MAX_POINTS)
    await repo.db.deleteGrowthLogs(rows.slice(0, rows.length + 1 - MAX_POINTS).map((r) => r.id));
  return true;
}

/** Day-0 baselines (create / import / restore): each node's starting counts, not written words. */
export async function recordBaseline(
  repo: NovelRepository,
  entries: readonly { nodeId: string; counts: GrowthCounts }[],
  now = repo.now(),
): Promise<void> {
  const rows: GrowthLogRow[] = [];
  for (const e of entries) {
    const bookId = await bookOf(repo, e.nodeId);
    if (bookId !== undefined) rows.push(row(e.nodeId, bookId, e.counts, now, true));
  }
  if (rows.length) await repo.db.putGrowthLogs(rows);
}

/** Words written today across a book's chapters (baselines subtracted, never negative). */
export async function todayWordsForBook(
  repo: NovelRepository,
  bookId: string,
  now = Date.now(),
): Promise<number> {
  const logs = (await repo.db.listGrowthLogs({ bookId })).filter((l) => l.nodeId !== bookId);
  return computeTodayWords(logs, dayKeyOf(now));
}

/** Test hook: forget write times. */
export const resetGrowthThrottle = (): void => lastWrite.clear();
