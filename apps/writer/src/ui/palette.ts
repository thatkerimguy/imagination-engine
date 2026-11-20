// Folio colour roles for the 12 curated themes (6 night, 6 day). Each theme is one row of eleven
// hand-tuned base hexes; washes and hairlines are mixed from them, so every theme stays calm and
// consistent. Every pair asserted in tokens.test.ts meets WCAG AA (>= 4.5:1). Pure data.

export interface FolioColors {
  /** Main page background. */
  canvas: string;
  /** Sheets and quiet panels. */
  surface: string;
  /** Popovers, dialogs, floating pills, active segment thumb. */
  surfaceElevated: string;
  /** 6–10 % accent wash: active rows, cue strips, press highlight. */
  surfaceTint: string;
  /** Primary reading text. */
  ink: string;
  /** Subtitles and metadata. */
  inkSecondary: string;
  /** Placeholders and quiet labels. */
  inkMuted: string;
  /** Text and icons on a solid accent fill. */
  onAccent: string;
  /** 1px dividers. */
  hairline: string;
  /** Focused input frame, active control outline. */
  borderStrong: string;
  /** The theme's one signature accent. */
  accent: string;
  /** Tinted accent background (selected tile, delta pill). */
  accentSoft: string;
  /** Amber: dialogue beats, overlay-VFX cues. */
  warm: string;
  danger: string;
  dangerSoft: string;
  success: string;
  /** Modal backdrop base (used with alpha). */
  scrim: string;
}

type BaseRole =
  | 'canvas'
  | 'surface'
  | 'surfaceElevated'
  | 'ink'
  | 'inkSecondary'
  | 'inkMuted'
  | 'accent'
  | 'onAccent'
  | 'warm'
  | 'danger'
  | 'success';

const BASE_ORDER: readonly BaseRole[] = [
  'canvas',
  'surface',
  'surfaceElevated',
  'ink',
  'inkSecondary',
  'inkMuted',
  'accent',
  'onAccent',
  'warm',
  'danger',
  'success',
];

/** Base rows, in BASE_ORDER. */
export const PALETTE_ROWS: Readonly<Record<string, string>> = {
  'editorial-teal-dark':
    '#101414 #161B1B #1F2525 #E3E7E6 #B3BFBD #8A9694 #4FD1C5 #00302C #E5A75A #FF8A80 #7BD88F',
  'obsidian-amoled':
    '#000000 #0C0D0F #17191C #E6E7E9 #B0B6BD #848B93 #7DD3FC #002E44 #F0B86E #FF8A80 #86EFAC',
  'charcoal-amber':
    '#161412 #1D1A17 #27231F #EDE5DB #C9BDB0 #9A8F83 #F0B36B #3D2300 #E8C27A #FF8A80 #A5D6A7',
  'midnight-slate':
    '#11141B #171B24 #20252F #E3E5ED #BAC0D0 #8B91A1 #93B4FF #00296A #E9B872 #FF8A80 #8FD8A0',
  'forest-night':
    '#101511 #161C17 #1F2620 #E1E5DE #B8C3B6 #8A9488 #8FD89E #003314 #E2B36E #FF8A80 #8FD89E',
  'nocturne-plum':
    '#161118 #1C1620 #261F2A #ECE2EE #C9BCCD #9A8EA0 #DFB5FF #3F1063 #F0B98A #FF8A80 #9AD6A6',
  'editorial-teal-light':
    '#F7FAF9 #EEF3F2 #FFFFFF #161D1C #46504E #626C6A #00695F #FFFFFF #8A5300 #B3261E #2E6B3A',
  'warm-sepia':
    '#F6F0E5 #EEE6D8 #FBF7F0 #2A2119 #554A3D #6C6053 #7A4F1C #FFFFFF #8F4413 #A3241B #3B6040',
  'paper-daylight':
    '#FAF9F6 #F1F0EC #FFFFFF #1B1B19 #4A4B46 #666761 #2F5D8A #FFFFFF #855410 #B3261E #2E6B3A',
  'sage-botanical':
    '#F4F8F3 #EAF1E9 #FFFFFF #171D17 #434B42 #60685F #2C6B3F #FFFFFF #855410 #B3261E #2C6B3F',
  'nordic-frost':
    '#F4F7FA #EAEFF5 #FFFFFF #181C21 #444A53 #60666F #2E5E8C #FFFFFF #855410 #B3261E #2E6B3A',
  'rose-parchment':
    '#FBF5F4 #F3EAEA #FFFFFF #221A1B #534546 #6E5F61 #8D4354 #FFFFFF #855410 #B3261E #2E6B3A',
};

const hex2 = (n: number): string =>
  Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();

/** Blends `fg` over `bg` at `amount` (0..1) into an opaque #RRGGBB. */
export function mix(fg: string, bg: string, amount: number): string {
  const ch = (h: string, i: number): number => parseInt(h.slice(i, i + 2), 16);
  let out = '#';
  for (const i of [1, 3, 5]) out += hex2(ch(bg, i) + (ch(fg, i) - ch(bg, i)) * amount);
  return out;
}

export function folioColors(row: string, dark: boolean): FolioColors {
  const v = row.split(' ');
  const base = Object.fromEntries(BASE_ORDER.map((r, i) => [r, v[i] ?? '#FF00FF'])) as Record<
    BaseRole,
    string
  >;
  return {
    ...base,
    surfaceTint: mix(base.accent, base.canvas, dark ? 0.09 : 0.07),
    accentSoft: mix(base.accent, base.canvas, dark ? 0.16 : 0.12),
    dangerSoft: mix(base.danger, base.canvas, dark ? 0.14 : 0.1),
    hairline: mix(base.ink, base.canvas, dark ? 0.12 : 0.1),
    borderStrong: mix(base.ink, base.canvas, 0.34),
    scrim: '#000000',
  };
}
