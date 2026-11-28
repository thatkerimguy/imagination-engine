// Writer ↔ reader live-preview messages (apps/writer/src/preview/protocol.ts mirrors these).
// The writer sends unsaved drafts; everything is re-validated with @kn/core before rendering.
import {
  checkChapterDocument as parseChapterDocument,
  checkNovelManifest as parseNovelManifest,
  checkSeasonManifest as parseSeasonManifest,
  type ChapterDocument,
  type NovelManifest,
  type SeasonManifest,
} from '@kn/core/guard';
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
  /** Current reading block, so the writer can replay scroll after a WebView renderer crash. */
  | { type: 'kn-preview-position'; blockId: string }
  | { type: 'kn-preview-error'; errors: string[] };

/** Host → reader control messages that are not chapter loads. */
export type HostControl =
  | { type: 'lifecycle'; state: 'active' | 'background' }
  | { type: 'a11y'; reducedMotion: boolean }
  /** 9:16 Record Mode: hide the reader's own chrome so only the chapter is captured. */
  | { type: 'record'; on: boolean }
  /** Live tier / Calm Mode switch: engines downgrade in place, no reload (OVERHAUL-03). */
  | { type: 'tier'; tier: TierPreference; calmMode: boolean }
  /** Live Visual DNA (archetype id or 7-axis object): restyles in place, engines get onDnaChange. */
  | { type: 'dna'; dna: unknown };

const TIERS: readonly TierPreference[] = ['auto', 'high', 'lite', 'reduced'];

function decode(raw: unknown): Record<string, unknown> | null {
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
}

/** Returns null for anything that is not a well-formed lifecycle / a11y / record message. */
export function parseHostControl(raw: unknown): HostControl | null {
  const msg = decode(raw);
  if (!msg) return null;
  if (msg.type === 'lifecycle' && (msg.state === 'active' || msg.state === 'background'))
    return { type: 'lifecycle', state: msg.state };
  if (msg.type === 'a11y' && typeof msg.reducedMotion === 'boolean')
    return { type: 'a11y', reducedMotion: msg.reducedMotion };
  if (msg.type === 'record' && typeof msg.on === 'boolean') return { type: 'record', on: msg.on };
  if (msg.type === 'dna' && msg.dna !== undefined && msg.dna !== null)
    return { type: 'dna', dna: msg.dna };
  if (msg.type === 'tier' && typeof msg.calmMode === 'boolean') {
    const tier = TIERS.find((t) => t === msg.tier);
    if (tier) return { type: 'tier', tier, calmMode: msg.calmMode };
  }
  return null;
}

export type ParsedLoad = { ok: true; load: PreviewLoad } | { ok: false; errors: string[] } | null;

/** Returns null for messages that are not preview loads (other tools may post to the window). */
export function parsePreviewLoad(raw: unknown): ParsedLoad {
  const msg = decode(raw);
  if (!msg || msg.type !== 'kn-preview-load') return null;
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
  // Book DNA and inline blueprints may ride beside the chapter; engines re-check both.
  const n = msg.visualDna !== undefined ? { ...novel.value, visualDna: msg.visualDna } : novel.value;
  const bp = msg.blueprints;
  const c =
    bp && typeof bp === 'object' && !Array.isArray(bp)
      ? { ...chapter.value, blueprints: { ...(bp as Record<string, unknown>), ...chapter.value.blueprints } }
      : chapter.value;
  return { ok: true, load: { novel: n, season: season.value, chapter: c, startBlockId, tier } };
}
