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
  /** Book Visual DNA (archetype id or 7-axis object); the reader re-validates it. */
  visualDna?: unknown;
  /** Inline v2 blueprints beside the chapter (the reader re-guards each one). */
  blueprints?: Record<string, unknown>;
}

/** Chrome Tide (the demo book) reads as Noir Rain; every other book defaults to Editorial Minimal. */
export const previewDna = (novel: Pick<NovelManifest, 'id' | 'visualDna'>): unknown =>
  novel.visualDna ?? (novel.id === 'vertical-slice' ? 'noir-rain' : 'editorial-minimal');

/** Live tier / Calm Mode switch: v2 engines downgrade in place, no reload or remount. */
export interface PreviewTierMessage {
  type: 'tier';
  tier: PreviewTier;
  calmMode: boolean;
}

export const tierMessage = (tier: PreviewTier, calmMode = false): PreviewTierMessage => ({
  type: 'tier',
  tier,
  calmMode,
});

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

/** 9:16 Record Mode: the reader hides its own top bar so only the chapter is captured. */
export interface PreviewRecordMessage {
  type: 'record';
  on: boolean;
}

/** Live Visual DNA push: the reader restyles in place, mounted engines get `onDnaChange`. */
export interface PreviewDnaMessage {
  type: 'dna';
  dna: unknown;
}

export const dnaMessage = (dna: unknown): PreviewDnaMessage => ({ type: 'dna', dna });

export type PreviewHostMessage =
  | PreviewLoadMessage
  | PreviewDnaMessage
  | PreviewLifecycleMessage
  | PreviewA11yMessage
  | PreviewRecordMessage
  | PreviewTierMessage;

export const recordMessage = (on: boolean): PreviewRecordMessage => ({ type: 'record', on });

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

/** Android KnReaderWebView's own events (renderer death, main-frame load failure). */
export type NativeFrameEvent =
  | { type: 'kn-native-render-gone'; didCrash: boolean }
  | { type: 'kn-native-load-error'; description: string };

export function parseNativeEvent(raw: string): NativeFrameEvent | null {
  let msg: unknown;
  try {
    msg = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!msg || typeof msg !== 'object') return null;
  const m = msg as Record<string, unknown>;
  if (m.type === 'kn-native-render-gone') return { type: m.type, didCrash: m.didCrash === true };
  if (m.type === 'kn-native-load-error')
    return {
      type: m.type,
      description: typeof m.description === 'string' ? m.description : 'The reader could not load.',
    };
  return null;
}
