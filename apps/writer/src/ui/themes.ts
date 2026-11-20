// The 12 curated M3 schemes (6 night, 6 day). Every foreground/background pair asserted in
// m3-tokens.test.ts meets WCAG AA (>= 4.5:1). Pure data: each scheme is one row of hex values in
// ROLE_ORDER; scrim / inverse roles are derived.
import type { ColorRoles } from './m3-tokens.ts';
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
  /** Folio colour roles. */
  colors: FolioColors;
  /** @deprecated Transitional M3 roles; removed once every screen is on Folio. */
  m3: ColorRoles;
}

type BaseRole = Exclude<keyof ColorRoles, 'scrim' | 'inverseSurface' | 'inverseOnSurface'>;

const ROLE_ORDER: readonly BaseRole[] = [
  'surface',
  'surfaceContainerLowest',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerHighest',
  'onSurface',
  'onSurfaceVariant',
  'primary',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'secondary',
  'onSecondary',
  'secondaryContainer',
  'onSecondaryContainer',
  'tertiary',
  'onTertiary',
  'tertiaryContainer',
  'onTertiaryContainer',
  'error',
  'onError',
  'errorContainer',
  'onErrorContainer',
  'outline',
  'outlineVariant',
];

const ROWS: readonly (readonly [ThemeId, string, 'dark' | 'light', string])[] = [
  [
    'editorial-teal-dark',
    'Editorial Teal',
    'dark',
    '#101414 #0B0F0F #181C1C #1C2020 #272B2B #313635 #E0E3E2 #BEC9C7 #4FD1C5 #003733 #00504A #A0F2E8 #B0CCC8 #1C3532 #324B48 #CCE8E4 #E0A458 #402500 #5C3700 #FFDDB6 #FFB4AB #690005 #93000A #FFDAD6 #889391 #3F4947',
  ],
  [
    'obsidian-amoled',
    'Obsidian AMOLED',
    'dark',
    '#000000 #000000 #0B0C0E #121417 #1B1E22 #24282D #E4E5E7 #B4BBC2 #7DD3FC #00344A #004C6B #C6E7FF #B5C8D8 #1F3340 #364957 #D1E4F4 #F0B86E #442800 #613C00 #FFDEBA #FFB4AB #690005 #93000A #FFDAD6 #858F99 #3A4047',
  ],
  [
    'charcoal-amber',
    'Charcoal Amber',
    'dark',
    '#161412 #100E0D #1E1B18 #23201C #2E2A25 #39342E #EAE1D7 #CFC4B8 #F0B36B #442700 #623B00 #FFDDB8 #D8C3AE #3B2E1E #534433 #F5DFC9 #A5D6A7 #0E3818 #24502D #C1F2C3 #FFB4AB #690005 #93000A #FFDAD6 #998E82 #4C453D',
  ],
  [
    'midnight-slate',
    'Midnight Slate',
    'dark',
    '#11141B #0C0E14 #191D26 #1E222D #282D3A #333948 #E2E4EC #C1C6D6 #93B4FF #002C6F #00419E #D8E2FF #BDC6DC #273141 #3D4759 #D9E2F8 #DDBCE0 #3F2844 #573E5C #FAD8FD #FFB4AB #690005 #93000A #FFDAD6 #8C919F #424754',
  ],
  [
    'forest-night',
    'Forest Night',
    'dark',
    '#101511 #0B0F0C #171D18 #1C231D #262D27 #313832 #E0E4DD #BFC9BC #8FD89E #003915 #095224 #ABF5B9 #B9CCB8 #243425 #3A4B3B #D5E8D3 #A1CED9 #00363F #1F4D57 #BDEAF6 #FFB4AB #690005 #93000A #FFDAD6 #8A9389 #404940',
  ],
  [
    'nocturne-plum',
    'Nocturne Plum',
    'dark',
    '#161118 #100C12 #1E1821 #231D27 #2E2732 #39313E #EAE0EC #CFC3D3 #DFB5FF #45136B #5D2E83 #F2DAFF #CFC1D8 #362C3E #4C4255 #EBDDF4 #F3B7BD #4C252A #663B40 #FFD9DC #FFB4AB #690005 #93000A #FFDAD6 #988D9E #4B4350',
  ],
  [
    'editorial-teal-light',
    'Editorial Light',
    'light',
    '#F5FAF9 #FFFFFF #EFF5F4 #E9EFEE #E4EAE8 #DEE4E2 #161D1C #3F4947 #006A62 #FFFFFF #9CF2E8 #00201D #4A6360 #FFFFFF #CCE8E4 #051F1D #825210 #FFFFFF #FFDDB6 #2A1700 #BA1A1A #FFFFFF #FFDAD6 #410002 #6F7977 #BEC9C7',
  ],
  [
    'warm-sepia',
    'Warm Sepia',
    'light',
    '#F5EFE4 #FBF7F0 #EFE7DA #E8DFD0 #E1D7C6 #DAD0BE #231D16 #4F463B #7A4F1C #FFFFFF #FFDCBA #291700 #675B4B #FFFFFF #EFE0CC #221A0E #476646 #FFFFFF #C9ECC5 #052109 #BA1A1A #FFFFFF #FFDAD6 #410002 #7E7467 #CFC4B4',
  ],
  [
    'paper-daylight',
    'Paper Daylight',
    'light',
    '#FAF9F6 #FFFFFF #F3F2EE #ECEBE6 #E5E4DF #DFDED8 #1B1B19 #464742 #2F5D8A #FFFFFF #D3E4FF #001C38 #535F70 #FFFFFF #D7E3F7 #101C2B #6B5778 #FFFFFF #F2DAFF #251431 #BA1A1A #FFFFFF #FFDAD6 #410002 #767771 #C6C7C0',
  ],
  [
    'sage-botanical',
    'Sage Botanical',
    'light',
    '#F3F8F2 #FFFFFF #ECF3EB #E5EDE4 #DFE7DE #D8E1D7 #171D17 #414940 #2C6B3F #FFFFFF #B0F3BC #00210B #516351 #FFFFFF #D3E8D1 #0F1F11 #39656F #FFFFFF #BDEAF6 #001F25 #BA1A1A #FFFFFF #FFDAD6 #410002 #717970 #C1C9BE',
  ],
  [
    'nordic-frost',
    'Nordic Frost',
    'light',
    '#F3F6FA #FFFFFF #ECF0F6 #E5EBF2 #DFE5ED #D8DFE8 #181C21 #424750 #2E5E8C #FFFFFF #D2E4FF #001C37 #526071 #FFFFFF #D5E4F8 #0E1D2B #69567A #FFFFFF #F0DBFF #231333 #BA1A1A #FFFFFF #FFDAD6 #410002 #727780 #C2C7D0',
  ],
  [
    'rose-parchment',
    'Rose Parchment',
    'light',
    '#FBF4F4 #FFFFFF #F5ECEC #EFE5E5 #E9DFDF #E2D8D8 #211A1B #514345 #8D4354 #FFFFFF #FFD9DF #3A0714 #74565B #FFFFFF #FFD9DF #2B1519 #7B5733 #FFFFFF #FFDCBC #2D1600 #BA1A1A #FFFFFF #FFDAD6 #410002 #837375 #D6C2C4',
  ],
];

function scheme([id, label, mode, hex]: (typeof ROWS)[number]): ThemeDef {
  const values = hex.split(' ');
  const base = Object.fromEntries(ROLE_ORDER.map((role, i) => [role, values[i] ?? '#FF00FF']));
  const roles = base as Record<BaseRole, string>;
  return {
    id,
    label,
    dark: mode === 'dark',
    colors: folioColors(PALETTE_ROWS[id] ?? '', mode === 'dark'),
    m3: {
      ...roles,
      scrim: '#000000',
      inverseSurface: roles.onSurface,
      inverseOnSurface: roles.surfaceContainerLow,
    },
  };
}

export const THEMES: readonly ThemeDef[] = ROWS.map(scheme);

const BY_ID = new Map<string, ThemeDef>(THEMES.map((t) => [t.id, t]));

export const DEFAULT_DARK: ThemeId = 'editorial-teal-dark';
export const DEFAULT_LIGHT: ThemeId = 'editorial-teal-light';

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && BY_ID.has(v);

export function getThemeDef(id: ThemeId): ThemeDef {
  return BY_ID.get(id) ?? THEMES[0]!;
}
