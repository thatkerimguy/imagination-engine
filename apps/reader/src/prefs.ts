import type { QualityTier } from '@kn/core/renderer';
import { readJson, writeJson } from './storage.ts';

export type ReadingTheme = 'warm' | 'dark' | 'obsidian';
export type TierPreference = 'auto' | QualityTier;

export interface Prefs {
  fontScale: number;
  theme: ReadingTheme;
  tier: TierPreference;
  sound: boolean;
}

const KEY = 'kn:prefs';
export const FONT_SCALES = [0.85, 0.92, 1, 1.1, 1.2, 1.32, 1.45] as const;
export const DEFAULT_PREFS: Prefs = { fontScale: 1, theme: 'dark', tier: 'auto', sound: true };

function isPrefs(v: unknown): v is Prefs {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.fontScale === 'number' &&
    ['warm', 'dark', 'obsidian'].includes(p.theme as string) &&
    ['auto', 'high', 'lite', 'reduced'].includes(p.tier as string) &&
    typeof p.sound === 'boolean'
  );
}

let current: Prefs = readJson(KEY, isPrefs) ?? DEFAULT_PREFS;
const listeners = new Set<(p: Prefs) => void>();

export const getPrefs = (): Prefs => current;

export function setPrefs(patch: Partial<Prefs>): void {
  current = { ...current, ...patch };
  writeJson(KEY, current);
  applyPrefs();
  listeners.forEach((l) => l(current));
}

export function onPrefsChange(listener: (p: Prefs) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyPrefs(root: HTMLElement = document.documentElement): void {
  root.dataset.theme = current.theme;
  root.style.setProperty('--font-scale', String(current.fontScale));
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute(
    'content',
    getComputedStyle(root).getPropertyValue('--bg').trim() || '#16171a',
  );
}
