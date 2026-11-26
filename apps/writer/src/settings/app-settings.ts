// Device-level writer settings (not part of any novel).
import type { NovelRepository } from '../store/repository.ts';
import { keys } from '../store/documents.ts';
import { LANGUAGE_SETTINGS, type LanguageSetting } from '../i18n/i18n.ts';

export type Appearance = 'dark' | 'light' | 'system';
export const APPEARANCES: readonly Appearance[] = ['dark', 'light', 'system'];

/** 'offline' = the reader bundled inside the app; 'custom-url' = a reader server at `readerUrl`. */
export type PreviewMode = 'offline' | 'custom-url';
export const PREVIEW_MODES: readonly PreviewMode[] = ['offline', 'custom-url'];

export interface AppSettings {
  /** Writer colour scheme; 'system' follows the OS. */
  appearance: Appearance;
  /** Where Live Preview gets its reader from. Defaults to the built-in offline copy. */
  previewMode: PreviewMode;
  /** Base URL of an apps/reader server (dev Vite, LAN, or deployed). `?preview=1` is added. */
  readerUrl: string;
  /** Opt-in anonymous crash reports (stack traces only, scrubbed). Off by default. */
  crashReportingEnabled: boolean;
  /** Writer interface language; 'system' follows the device. */
  language: LanguageSetting;
}

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: 'dark',
  previewMode: 'offline',
  readerUrl: 'http://127.0.0.1:5173/',
  crashReportingEnabled: false,
  language: 'system',
};

export async function loadSettings(repo: NovelRepository): Promise<AppSettings> {
  const stored = await repo.docs.read<Partial<AppSettings>>(keys.setting('app'));
  const merged = { ...DEFAULT_SETTINGS, ...stored?.data };
  if (!APPEARANCES.includes(merged.appearance)) merged.appearance = DEFAULT_SETTINGS.appearance;
  if (!PREVIEW_MODES.includes(merged.previewMode))
    merged.previewMode = DEFAULT_SETTINGS.previewMode;
  merged.crashReportingEnabled = merged.crashReportingEnabled === true;
  if (!LANGUAGE_SETTINGS.includes(merged.language)) merged.language = DEFAULT_SETTINGS.language;
  return merged;
}

/** Merges a partial update into the stored settings. */
export async function saveSettings(
  repo: NovelRepository,
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const next = { ...(await loadSettings(repo)), ...patch };
  await repo.docs.write(keys.setting('app'), next);
  return next;
}

/** Normalises a typed URL into the reader's preview entry point, or null when unusable. */
export function previewUrl(readerUrl: string): string | null {
  try {
    const url = new URL(readerUrl.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.searchParams.set('preview', '1');
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}
