import type { QualityTier } from '@kn/core/renderer';
import { readJson, writeJson } from './storage.ts';

/** `book` (default) = the book's Visual DNA page ground on a light/dark base that follows the OS. */
export type ReadingTheme = 'book' | 'warm' | 'dark' | 'obsidian';
/** `book` (default) = the book's DNA prose voice; `serif` / `sans` are reader overrides. */
export type ReadingFont = 'book' | 'serif' | 'sans';
export type TierPreference = 'auto' | QualityTier;

export interface Prefs {
  fontScale: number;
  theme: ReadingTheme;
  font: ReadingFont;
  tier: TierPreference;
  sound: boolean;
  /** One-tap override layer: forces the reduced tier and silences audio without touching tier/sound. */
  calmMode: boolean;
}

const KEY = 'kn:prefs';
export const FONT_SCALES = [0.85, 0.92, 1, 1.1, 1.2, 1.32, 1.45] as const;
export const DEFAULT_PREFS: Prefs = {
  fontScale: 1,
  theme: 'book',
  font: 'book',
  tier: 'auto',
  sound: true,
  calmMode: false,
};

/** Audio is audible only when the reader wants sound and Calm Mode is off. */
export const soundAllowed = (p: Prefs): boolean => p.sound && !p.calmMode;

function isPrefs(v: unknown): v is Prefs {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.fontScale === 'number' &&
    ['book', 'warm', 'dark', 'obsidian'].includes(p.theme as string) &&
    (p.font === undefined || ['book', 'serif', 'sans'].includes(p.font as string)) &&
    ['auto', 'high', 'lite', 'reduced'].includes(p.tier as string) &&
    typeof p.sound === 'boolean' &&
    (p.calmMode === undefined || typeof p.calmMode === 'boolean')
  );
}

let current: Prefs = { ...DEFAULT_PREFS, ...readJson(KEY, isPrefs) };
current.font ??= 'book';

export const getPrefs = (): Prefs => current;

export function setPrefs(patch: Partial<Prefs>): void {
  current = { ...current, ...patch };
  writeJson(KEY, current);
  applyPrefs();
}

const prefersLight = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;

let watchingScheme = false;

/**
 * `data-theme` is always a concrete base palette (warm | dark | obsidian) so CSS and DNA
 * resolution stay simple; `data-theme-pref` / `data-font-pref` = `book` opt into the book's
 * Soft Page Harmony tokens, and any manual reader choice overrides them completely.
 */
export function applyPrefs(root: HTMLElement = document.documentElement): void {
  const t = current.theme;
  root.dataset.theme = t === 'book' ? (prefersLight() ? 'warm' : 'dark') : t;
  root.dataset.themePref = t;
  root.dataset.fontPref = current.font;
  if (t === 'book' && !watchingScheme && typeof matchMedia === 'function') {
    watchingScheme = true;
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (current.theme === 'book') applyPrefs(root);
    });
  }
  root.style.setProperty('--font-scale', String(current.fontScale));
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute(
    'content',
    getComputedStyle(root).getPropertyValue('--bg').trim() || '#16171a',
  );
}
