// Material You: turns the phone's Android 12+ wallpaper tonal palette into a full Folio colour set.
// 'exact' keeps the wallpaper surfaces as Android reports them; 'soft' pulls them 35 % toward
// Folio's calm charcoal / paper so loud wallpapers stay restful. Either way an automatic contrast
// guard nudges every text/background pair to WCAG AA (>= 4.5:1). Pure TS (unit tested); the
// native read lives in material-you-native.ts.
import { mix, type FolioColors } from './palette.ts';

export interface WallpaperPalette {
  canvas: string;
  surface: string;
  surfaceElevated: string;
  accent: string;
  warm: string;
}

export type MaterialYouMode = 'dark' | 'light';
export type MaterialYouStyle = 'soft' | 'exact';

export const AA = 4.5;
/** Body text gets more headroom than AA so the secondary / muted inks still have room. */
const BODY = 7;
const SOFT_AMOUNT = 0.35;
const SOFT_BASE: Record<MaterialYouMode, string> = { dark: '#111314', light: '#F7F6F3' };
const INK_BASE: Record<MaterialYouMode, string> = { dark: '#E6E8E7', light: '#161A19' };
const DANGER: Record<MaterialYouMode, string> = { dark: '#FF8A80', light: '#B3261E' };
const SUCCESS: Record<MaterialYouMode, string> = { dark: '#7BD88F', light: '#2E6B3A' };
const ON_ACCENT = ['#0B0D0D', '#FFFFFF'] as const;

const HEX = /^#[0-9A-F]{6}$/i;
export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

export function luminance(hex: string): number {
  const lin = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const worst = (fg: string, bgs: readonly string[]): number =>
  Math.min(...bgs.map((bg) => contrast(fg, bg)));

/** Moves `color` toward `toward` in small steps until it reaches `min` contrast on every bg. */
function ensure(color: string, bgs: readonly string[], toward: string, min = AA): string {
  let c = color.toUpperCase();
  for (let i = 0; i < 40 && worst(c, bgs) < min; i++) c = mix(toward, c, 0.12);
  return worst(c, bgs) >= min ? c : toward;
}

const betterOn = (bg: string): string =>
  contrast(ON_ACCENT[0], bg) >= contrast(ON_ACCENT[1], bg) ? ON_ACCENT[0] : ON_ACCENT[1];

/** Pure: wallpaper tonal palette → Folio colours that clear WCAG AA everywhere text sits. */
export function buildMaterialYouTheme(
  raw: WallpaperPalette,
  mode: MaterialYouMode,
  style: MaterialYouStyle,
): FolioColors {
  const dark = mode === 'dark';
  const light = '#FFFFFF';
  const black = '#000000';
  const away = dark ? black : light; // where backgrounds retreat to
  const toward = dark ? light : black; // where foregrounds retreat to
  const tone = (c: string): string =>
    style === 'soft' ? mix(c, SOFT_BASE[mode], 1 - SOFT_AMOUNT) : c.toUpperCase();

  // Ink carries a whisper of the wallpaper accent; backgrounds keep body-text headroom from it.
  const ink0 = mix(raw.accent, INK_BASE[mode], 0.06);
  const canvas = ensure(tone(raw.canvas), [ink0], away, BODY);
  const surface = ensure(tone(raw.surface), [ink0], away, BODY);
  const surfaceElevated = ensure(tone(raw.surfaceElevated), [ink0], away, BODY);
  const bases = [canvas, surface, surfaceElevated];

  // Accent must read on every surface (and its own washes) and carry text on its fill.
  let accent = raw.accent.toUpperCase();
  let tint = canvas;
  let soft = canvas;
  let onAccent: string = ON_ACCENT[0];
  for (let i = 0; i < 40; i++) {
    tint = mix(accent, canvas, dark ? 0.09 : 0.07);
    soft = mix(accent, canvas, dark ? 0.16 : 0.12);
    onAccent = betterOn(accent);
    const ok = worst(accent, [...bases, tint, soft]) >= AA && contrast(onAccent, accent) >= AA;
    if (ok) break;
    accent = mix(toward, accent, 0.12);
  }

  let danger = DANGER[mode];
  let dangerSoft = canvas;
  for (let i = 0; i < 40; i++) {
    dangerSoft = mix(danger, canvas, dark ? 0.14 : 0.1);
    if (worst(danger, [canvas, surface, dangerSoft]) >= AA) break;
    danger = mix(toward, danger, 0.12);
  }

  const ink = ensure(ink0, [...bases, tint, soft], toward, BODY);
  const inkSecondary = ensure(mix(ink, canvas, 0.78), [...bases, tint], ink);
  const inkMuted = ensure(mix(ink, canvas, 0.62), [canvas, surface], ink);

  return {
    canvas,
    surface,
    surfaceElevated,
    surfaceTint: tint,
    ink,
    inkSecondary,
    inkMuted,
    onAccent,
    hairline: mix(ink, canvas, dark ? 0.12 : 0.1),
    borderStrong: mix(ink, canvas, 0.34),
    accent,
    accentSoft: soft,
    warm: ensure(raw.warm, [canvas, surface], toward),
    danger,
    dangerSoft,
    success: ensure(SUCCESS[mode], [canvas, surface], toward),
    scrim: '#000000',
  };
}

/** Narrows whatever the native side resolved into a palette (or null). */
export function parseWallpaperPalette(v: unknown): WallpaperPalette | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const { canvas, surface, surfaceElevated, accent, warm } = o;
  if (![canvas, surface, surfaceElevated, accent, warm].every(isHex)) return null;
  return { canvas, surface, surfaceElevated, accent, warm } as WallpaperPalette;
}
