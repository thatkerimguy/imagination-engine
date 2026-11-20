// Writing-growth history (`growth/<targetId>`): periodic snapshots of text counts per chapter,
// novel, document or folder, throttled to one stored point per 5 minutes, with daily rollups for
// the Growth charts.
import type { NovelRepository } from './repository.ts';

export type GrowthTarget =
  `chapter:${string}` | `novel:${string}` | `doc:${string}` | `folder:${string}`;

export interface GrowthCounts {
  chars: number;
  words: number;
  sentences: number;
  paragraphs: number;
}

export interface GrowthPoint extends GrowthCounts {
  /** Local calendar day, `YYYY-MM-DD`. */
  dayKey: string;
  ts: number;
}

export interface GrowthSeries {
  points: GrowthPoint[];
}

export type GrowthRange = 'today' | '7d' | '30d' | '1y' | 'lifetime';

export const GROWTH_THROTTLE_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_POINTS = 5000;

export const growthKey = (target: GrowthTarget): string => `growth/${target}`;

export function dayKeyOf(ts: number): string {
  const d = new Date(ts);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Adds a snapshot. Within the throttle window of the previous point (same day) the previous
 * point is replaced instead, so a long session stores one point per 5 minutes. Pure.
 */
export function appendPoint(
  series: GrowthSeries,
  counts: GrowthCounts,
  ts: number,
  throttleMs = GROWTH_THROTTLE_MS,
): GrowthSeries {
  const point: GrowthPoint = { dayKey: dayKeyOf(ts), ts, ...counts };
  const last = series.points.at(-1);
  if (last && last.dayKey === point.dayKey && ts - last.ts < throttleMs) {
    // Keep the window's first timestamp so a steady typist still gets a point every 5 minutes.
    return { points: [...series.points.slice(0, -1), { ...point, ts: last.ts }] };
  }
  return { points: [...series.points, point].slice(-MAX_POINTS) };
}

/** One point per day: the last snapshot of each day. */
export function dailyRollup(points: readonly GrowthPoint[]): GrowthPoint[] {
  const byDay = new Map<string, GrowthPoint>();
  for (const p of points) byDay.set(p.dayKey, p);
  return [...byDay.values()].sort((a, b) => a.ts - b.ts);
}

/** Points to chart for a timeframe: raw snapshots for Today, daily rollups otherwise. */
export function seriesForRange(
  points: readonly GrowthPoint[],
  range: GrowthRange,
  now: number,
): GrowthPoint[] {
  if (range === 'today') {
    const today = dayKeyOf(now);
    return points.filter((p) => p.dayKey === today);
  }
  const days = { '7d': 7, '30d': 30, '1y': 365, lifetime: Infinity }[range];
  const since = now - days * DAY_MS;
  return dailyRollup(points).filter((p) => p.ts >= since);
}

/** Change across a charted range (last minus first; a single point counts from zero). */
export function periodDelta(points: readonly GrowthPoint[]): GrowthCounts {
  const first = points.length > 1 ? points[0] : undefined;
  const last = points.at(-1);
  const d = (k: keyof GrowthCounts): number => (last?.[k] ?? 0) - (first?.[k] ?? 0);
  return {
    chars: d('chars'),
    words: d('words'),
    sentences: d('sentences'),
    paragraphs: d('paragraphs'),
  };
}

export async function loadGrowth(
  repo: NovelRepository,
  target: GrowthTarget,
): Promise<GrowthSeries> {
  const stored = await repo.docs.read<GrowthSeries>(growthKey(target));
  const points = stored?.data.points;
  return { points: Array.isArray(points) ? points.filter((p) => typeof p?.ts === 'number') : [] };
}

/** Last write time per target, so flushes inside the throttle window cost no storage I/O. */
const lastWrite = new Map<GrowthTarget, number>();

/**
 * Records a snapshot. Skips the write when the target was written less than 5 minutes ago,
 * unless `force` (e.g. when the editor closes). `counts` may be a function so the (costly) count
 * only runs when a write will happen. Returns whether it wrote.
 */
export async function recordGrowth(
  repo: NovelRepository,
  target: GrowthTarget,
  counts: GrowthCounts | (() => GrowthCounts | Promise<GrowthCounts>),
  opts: { now?: number; force?: boolean } = {},
): Promise<boolean> {
  const now = opts.now ?? Date.now();
  const prev = lastWrite.get(target);
  if (!opts.force && prev !== undefined && now - prev < GROWTH_THROTTLE_MS) return false;
  lastWrite.set(target, now);
  const value = typeof counts === 'function' ? await counts() : counts;
  const next = appendPoint(await loadGrowth(repo, target), value, now);
  await repo.docs.write(growthKey(target), next);
  return true;
}

/** Test hook: forget write times. */
export const resetGrowthThrottle = (): void => lastWrite.clear();
