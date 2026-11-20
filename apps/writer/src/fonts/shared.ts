// Platform-independent font loading: preset + custom face resolution and the lazy-load hook.
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';
import { useRepository } from '../store/context.tsx';
import type { NovelRepository } from '../store/repository.ts';
import { loadCustomFonts } from '../store/writer-prefs.ts';
import { DEFAULT_FONT_ID, getFontPreset } from './catalog.ts';
import { findFont } from './registry.ts';

const fallbackFamily = (): string => getFontPreset(DEFAULT_FONT_ID)?.family ?? 'serif';

/** Loads a preset or custom face (once) and returns its fontFamily, or null if unknown / failed. */
export async function loadFontById(repo: NovelRepository, fontId: string): Promise<string | null> {
  try {
    const preset = getFontPreset(fontId);
    if (preset) {
      if (preset.source !== undefined && !Font.isLoaded(preset.family)) {
        await Font.loadAsync({ [preset.family]: preset.source });
      }
      return preset.family;
    }
    const custom = findFont(await loadCustomFonts(repo), fontId);
    if (!custom) return null;
    if (!Font.isLoaded(custom.id)) await Font.loadAsync({ [custom.id]: custom.uri });
    return custom.id;
  } catch {
    return null;
  }
}

/**
 * The fontFamily to render for a font id. Starts the lazy load on first use and returns the
 * classic-serif family until the face is ready.
 */
export function useFontFamily(fontId: string): string {
  const repo = useRepository();
  const [loaded, setLoaded] = useState<{ id: string; family: string } | null>(null);
  useEffect(() => {
    let live = true;
    void loadFontById(repo, fontId).then((family) => {
      if (live && family) setLoaded({ id: fontId, family });
    });
    return () => {
      live = false;
    };
  }, [repo, fontId]);
  const preset = getFontPreset(fontId);
  if (preset && (preset.source === undefined || Font.isLoaded(preset.family))) return preset.family;
  return loaded?.id === fontId ? loaded.family : fallbackFamily();
}
