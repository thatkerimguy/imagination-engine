// Pure payload for the Android home-screen writing widget (DIRECTIVE-07 E). The widget lives
// outside the app's Master Lock overlay, so whenever any lock covers the work the payload is
// redacted: no novel or chapter title, no counts, and the tap lands on the Library (`/`).
import { computeTodayWords } from '@kn/core';
import { dayKeyOf, type GrowthPoint } from '../store/growth-series.ts';

export const WIDGET_SCHEME = 'kinetic-writer://';
export const REDACTED_HEADLINE = 'Imagination Engine';
export const REDACTED_SUBLINE = 'Tap to unlock and write';
export const REDACTED_WORDS = 'Protected';

/** The most recently edited, non-trashed chapter (null when there is none). */
export interface RecentChapter {
  novelId: string;
  seasonId: string;
  chapterId: string;
  novelTitle: string;
  chapterTitle: string;
}

export interface WidgetInput {
  /** Master Lock is on (regardless of whether this session is unlocked). */
  lockEnabled: boolean;
  /** The recent chapter's novel or chapter carries its own per-item lock. */
  itemLocked?: boolean;
  recent: RecentChapter | null;
  todayWords: number;
  formatNumber?: (n: number) => string;
}

export interface WidgetPayload {
  headline: string;
  subline: string;
  todayWordsLabel: string;
  deepLinkUri: string;
  redacted: boolean;
}

const clip = (s: string, max: number): string => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

export const chapterDeepLink = (r: RecentChapter): string =>
  `${WIDGET_SCHEME}novel/${encodeURIComponent(r.novelId)}/chapter/${encodeURIComponent(
    r.seasonId,
  )}/${encodeURIComponent(r.chapterId)}`;

export function buildWidgetPayload(input: WidgetInput): WidgetPayload {
  if (input.lockEnabled || input.itemLocked === true) {
    return {
      headline: REDACTED_HEADLINE,
      subline: REDACTED_SUBLINE,
      todayWordsLabel: REDACTED_WORDS,
      deepLinkUri: WIDGET_SCHEME,
      redacted: true,
    };
  }
  const n = Math.max(0, Math.round(input.todayWords));
  const fmt = input.formatNumber ?? ((v: number) => String(v));
  const todayWordsLabel = `${fmt(n)} ${n === 1 ? 'word' : 'words'} today`;
  if (!input.recent) {
    return {
      headline: REDACTED_HEADLINE,
      subline: 'Tap to start writing',
      todayWordsLabel,
      deepLinkUri: WIDGET_SCHEME,
      redacted: false,
    };
  }
  const r = input.recent;
  return {
    headline: clip(r.chapterTitle || 'Untitled chapter', 40),
    subline: clip(r.novelTitle || 'Untitled novel', 48),
    todayWordsLabel,
    deepLinkUri: chapterDeepLink(r),
    redacted: false,
  };
}

/**
 * Words added today from one growth series: today's latest snapshot minus today's day-0 baseline
 * (create / import / restore) or, without one, the last snapshot before today. 0 when nothing was
 * written today; never negative (deleting is not "writing").
 */
export function todayWordsFrom(points: readonly GrowthPoint[], now: number): number {
  const logs = points.map((p) => ({
    nodeId: 'series',
    dateKey: p.dayKey,
    wordCount: p.words,
    isBaseline: p.baseline === true,
    recordedAt: new Date(p.ts).toISOString(),
  }));
  return computeTodayWords(logs, dayKeyOf(now));
}
