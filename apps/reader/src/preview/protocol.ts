// Writer ↔ reader live-preview messages (apps/writer/src/preview/protocol.ts mirrors these).
// The writer sends unsaved drafts; everything is re-validated with @kn/core before rendering.
import {
  parseChapterDocument,
  parseNovelManifest,
  parseSeasonManifest,
  type ChapterDocument,
  type NovelManifest,
  type SeasonManifest,
} from '@kn/core';
import type { TierPreference } from '../prefs.ts';

export interface PreviewLoad {
  novel: NovelManifest;
  season: SeasonManifest;
  chapter: ChapterDocument;
  startBlockId: string | null;
  tier: TierPreference;
}

export type HostMessage =
  | { type: 'kn-preview-ready' }
  | { type: 'kn-preview-rendered'; chapterId: string }
  | { type: 'kn-preview-error'; errors: string[] };

const TIERS: readonly TierPreference[] = ['auto', 'high', 'lite', 'reduced'];

export type ParsedLoad = { ok: true; load: PreviewLoad } | { ok: false; errors: string[] } | null;

/** Returns null for messages that are not preview loads (other tools may post to the window). */
export function parsePreviewLoad(raw: unknown): ParsedLoad {
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;
  const msg = data as Record<string, unknown>;
  if (msg.type !== 'kn-preview-load') return null;
  const novel = parseNovelManifest(msg.novel);
  const season = parseSeasonManifest(msg.season);
  const chapter = parseChapterDocument(msg.chapter);
  const errors = [
    ...(novel.ok ? [] : novel.errors.map((e) => `novel ${e}`)),
    ...(season.ok ? [] : season.errors.map((e) => `season ${e}`)),
    ...(chapter.ok ? [] : chapter.errors.map((e) => `chapter ${e}`)),
  ];
  if (!novel.ok || !season.ok || !chapter.ok) return { ok: false, errors };
  const tier = TIERS.find((t) => t === msg.tier) ?? 'auto';
  const startBlockId = typeof msg.startBlockId === 'string' ? msg.startBlockId : null;
  return {
    ok: true,
    load: { novel: novel.value, season: season.value, chapter: chapter.value, startBlockId, tier },
  };
}
