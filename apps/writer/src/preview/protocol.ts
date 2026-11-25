// Writer ↔ reader live-preview messages. Mirrors apps/reader/src/preview/protocol.ts.
import type { ChapterDocument, NovelManifest, SeasonManifest } from '@kn/core';

export type PreviewTier = 'auto' | 'high' | 'lite' | 'reduced';
export const PREVIEW_TIERS: readonly PreviewTier[] = ['auto', 'high', 'lite', 'reduced'];

export interface PreviewLoadMessage {
  type: 'kn-preview-load';
  novel: NovelManifest;
  season: SeasonManifest;
  chapter: ChapterDocument;
  startBlockId?: string;
  tier: PreviewTier;
}

export type LifecycleState = 'active' | 'background';

/** Host app moved to/from the background: the reader pauses audio, RAF loops and sensors. */
export interface PreviewLifecycleMessage {
  type: 'lifecycle';
  state: LifecycleState;
}

/** OS accessibility state the WebView cannot see itself (Android "Remove animations"). */
export interface PreviewA11yMessage {
  type: 'a11y';
  reducedMotion: boolean;
}

export type PreviewHostMessage = PreviewLoadMessage | PreviewLifecycleMessage | PreviewA11yMessage;

export const lifecycleMessage = (active: boolean): PreviewLifecycleMessage => ({
  type: 'lifecycle',
  state: active ? 'active' : 'background',
});

export const a11yMessage = (reducedMotion: boolean): PreviewA11yMessage => ({
  type: 'a11y',
  reducedMotion,
});

export type ReaderMessage =
  | { type: 'kn-preview-ready' }
  | { type: 'kn-preview-rendered'; chapterId: string }
  | { type: 'kn-preview-position'; blockId: string }
  | { type: 'kn-preview-error'; errors: string[] };

/** Accepts both the RN WebView string payload and a structured-clone object from an iframe. */
export function parseReaderMessage(raw: unknown): ReaderMessage | null {
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
  switch (msg.type) {
    case 'kn-preview-ready':
      return { type: 'kn-preview-ready' };
    case 'kn-preview-rendered':
      return typeof msg.chapterId === 'string'
        ? { type: 'kn-preview-rendered', chapterId: msg.chapterId }
        : null;
    case 'kn-preview-position':
      return typeof msg.blockId === 'string'
        ? { type: 'kn-preview-position', blockId: msg.blockId }
        : null;
    case 'kn-preview-error':
      return {
        type: 'kn-preview-error',
        errors: Array.isArray(msg.errors) ? msg.errors.filter((e) => typeof e === 'string') : [],
      };
    default:
      return null;
  }
}
