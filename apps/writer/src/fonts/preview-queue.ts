// Preview-font loading for the Appearance picker: a tiny module-level queue that loads a few
// faces at a time instead of firing every `Font.loadAsync` at once on mount.
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';
import { useRepository } from '../store/context.tsx';
import { DEFAULT_FONT_ID, getFontPreset } from './catalog.ts';
import { loadFontById } from './shared.ts';

const BATCH = 3;
const waiting: (() => void)[] = [];
let running = 0;

function pump(): void {
  while (running < BATCH && waiting.length > 0) {
    const start = waiting.shift();
    if (!start) break;
    running++;
    start();
  }
}

/** Runs `task` once a slot (max 3 concurrent) is free. Never rejects; resolves to null on skip. */
function enqueue<T>(task: () => Promise<T>, skip: () => boolean): Promise<T | null> {
  return new Promise((resolve) => {
    waiting.push(() => {
      const done = (value: T | null): void => {
        running--;
        resolve(value);
        pump();
      };
      if (skip()) done(null);
      else task().then(done, () => done(null));
    });
    pump();
  });
}

/**
 * fontFamily for a picker row. Rows render with the fallback face until their font loads through
 * the queue, then swap. `immediate` (the selected row) bypasses the queue.
 */
export function usePreviewFamily(fontId: string, immediate: boolean): string {
  const repo = useRepository();
  const [loaded, setLoaded] = useState<{ id: string; family: string } | null>(null);
  useEffect(() => {
    let live = true;
    const load = (): Promise<string | null> => loadFontById(repo, fontId);
    const run = immediate ? load() : enqueue(load, () => !live);
    void run.then((family) => {
      if (live && family) setLoaded({ id: fontId, family });
    });
    return () => {
      live = false;
    };
  }, [repo, fontId, immediate]);
  const preset = getFontPreset(fontId);
  if (preset && (preset.source === undefined || Font.isLoaded(preset.family))) return preset.family;
  if (loaded?.id === fontId) return loaded.family;
  return getFontPreset(DEFAULT_FONT_ID)?.family ?? 'serif';
}
