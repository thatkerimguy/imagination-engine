// The 12 curated Folio themes (6 night, 6 day). Colour roles come from palette.ts; every pair
// asserted in tokens.test.ts meets WCAG AA (>= 4.5:1). Pure data.
import { folioColors, PALETTE_ROWS, type FolioColors } from './palette.ts';

export const THEME_IDS = [
  'editorial-teal-dark',
  'obsidian-amoled',
  'charcoal-amber',
  'midnight-slate',
  'forest-night',
  'nocturne-plum',
  'editorial-teal-light',
  'warm-sepia',
  'paper-daylight',
  'sage-botanical',
  'nordic-frost',
  'rose-parchment',
] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemeDef {
  id: ThemeId;
  label: string;
  dark: boolean;
  colors: FolioColors;
}

const ROWS: readonly (readonly [ThemeId, string, 'dark' | 'light'])[] = [
  ['editorial-teal-dark', 'Editorial Teal', 'dark'],
  ['obsidian-amoled', 'Obsidian AMOLED', 'dark'],
  ['charcoal-amber', 'Charcoal Amber', 'dark'],
  ['midnight-slate', 'Midnight Slate', 'dark'],
  ['forest-night', 'Forest Night', 'dark'],
  ['nocturne-plum', 'Nocturne Plum', 'dark'],
  ['editorial-teal-light', 'Editorial Light', 'light'],
  ['warm-sepia', 'Warm Sepia', 'light'],
  ['paper-daylight', 'Paper Daylight', 'light'],
  ['sage-botanical', 'Sage Botanical', 'light'],
  ['nordic-frost', 'Nordic Frost', 'light'],
  ['rose-parchment', 'Rose Parchment', 'light'],
];

export const THEMES: readonly ThemeDef[] = ROWS.map(([id, label, mode]) => ({
  id,
  label,
  dark: mode === 'dark',
  colors: folioColors(PALETTE_ROWS[id] ?? '', mode === 'dark'),
}));

const BY_ID = new Map<string, ThemeDef>(THEMES.map((t) => [t.id, t]));

export const DEFAULT_DARK: ThemeId = 'editorial-teal-dark';
export const DEFAULT_LIGHT: ThemeId = 'editorial-teal-light';

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && BY_ID.has(v);

export function getThemeDef(id: ThemeId): ThemeDef {
  return BY_ID.get(id) ?? THEMES[0]!;
}
