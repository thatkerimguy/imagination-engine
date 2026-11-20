// Device-level writer settings (not part of any novel).
import type { NovelRepository } from '../store/repository.ts';
import { keys } from '../store/documents.ts';

export interface AppSettings {
  /** Base URL of an apps/reader server (dev Vite, LAN, or deployed). `?preview=1` is added. */
  readerUrl: string;
}

export const DEFAULT_SETTINGS: AppSettings = { readerUrl: 'http://127.0.0.1:5173/' };

export async function loadSettings(repo: NovelRepository): Promise<AppSettings> {
  const stored = await repo.docs.read<Partial<AppSettings>>(keys.setting('app'));
  return { ...DEFAULT_SETTINGS, ...stored?.data };
}

export async function saveSettings(repo: NovelRepository, settings: AppSettings): Promise<void> {
  await repo.docs.write(keys.setting('app'), settings);
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
