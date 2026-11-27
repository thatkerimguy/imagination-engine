// Resolves Book Visual DNA into paired, contrast-clamped CSS tokens for a dark or light theme.
// Ink and muted text always pass WCAG ≥ 4.5:1 and APCA |Lc| ≥ 60; accents, warn and ok pass
// ≥ 3:1 and ≥ 45 — each against the page background AND both card surfaces.
import { ensureContrast, oklchToHex, type ContrastTarget, type Oklch } from './contrast.ts';
import type {
  BookVisualDna,
  DnaColorToken,
  DnaTheme,
  FontVoice,
  MotionPersonality,
  ResolvedVisualDna,
} from './types.ts';

export const BODY_TARGET: ContrastTarget = { wcag: 4.5, apca: 60 };
export const UI_TARGET: ContrastTarget = { wcag: 3, apca: 45 };
const HIGH_BODY: ContrastTarget = { wcag: 7, apca: 75 };
const HIGH_UI: ContrastTarget = { wcag: 4.5, apca: 60 };

/** System / web-safe stacks only: zero font downloads, so the offline reader looks the same. */
export const FONT_STACKS: Record<FontVoice, string> = {
  'serif-editorial': "Charter, 'Iowan Old Style', 'Source Serif Pro', Georgia, 'Noto Serif', serif",
  'serif-antique':
    "'Palatino Linotype', Palatino, 'Book Antiqua', 'Goudy Old Style', Georgia, serif",
  'sans-clean': "Inter, 'Segoe UI', Roboto, 'Helvetica Neue', system-ui, sans-serif",
  'sans-condensed': "'Bahnschrift SemiCondensed', 'Roboto Condensed', 'Arial Narrow', sans-serif",
  'mono-terminal': "'JetBrains Mono', 'SF Mono', Consolas, 'Roboto Mono', monospace",
  'mono-typewriter': "'American Typewriter', 'Courier Prime', 'Courier New', Courier, monospace",
};

const EASE: Record<MotionPersonality, [string, number]> = {
  crisp: ['cubic-bezier(.2,.8,.2,1)', 1],
  mechanical: ['cubic-bezier(.7,0,.3,1)', 0.8],
  organic: ['cubic-bezier(.34,1.3,.64,1)', 1.25],
  cinematic: ['cubic-bezier(.16,1,.3,1)', 1.7],
  still: ['linear', 0],
};

const clampNum = (n: number, lo: number, hi: number): number =>
  Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
const wrapHue = (h: number): number => (((Number.isFinite(h) ? h : 0) % 360) + 360) % 360;

function lerpHue(from: number, to: number, t: number): number {
  const d = ((to - from + 540) % 360) - 180;
  return wrapHue(from + d * t);
}

export function resolveVisualDna(dna: BookVisualDna, theme: DnaTheme): ResolvedVisualDna {
  const dark = theme === 'dark';
  const p = dna.palette;
  const hue = wrapHue(p.hue);
  const chroma = clampNum(p.chroma, 0, 0.37);
  const warmth = clampNum(p.warmth, -1, 1);
  const high = p.contrastMode === 'high';
  const body = high ? HIGH_BODY : BODY_TARGET;
  const ui = high ? HIGH_UI : UI_TARGET;
  const neutral = warmth >= 0 ? lerpHue(hue, 70, warmth * 0.6) : lerpHue(hue, 240, -warmth * 0.6);
  const tint = Math.min(0.04, chroma * 0.18 + Math.abs(warmth) * 0.012);
  const at = (l: number, c: number, h: number): Oklch => ({ l, c, h });

  const bg = oklchToHex(at(dark ? (high ? 0.13 : 0.17) : high ? 0.985 : 0.965, tint, neutral));
  const surface = oklchToHex(at(dark ? (high ? 0.18 : 0.215) : 0.995, tint * 0.8, neutral));
  const surfaceAlt = oklchToHex(at(dark ? (high ? 0.22 : 0.26) : 0.935, tint * 1.2, neutral));
  const grounds = [bg, surface, surfaceAlt];
  const fit = (c: Oklch, t: ContrastTarget): string =>
    ensureContrast(c, grounds, t.wcag, t.apca, theme);

  const colors: Record<DnaColorToken, string> = {
    '--dna-bg': bg,
    '--dna-surface': surface,
    '--dna-surface-alt': surfaceAlt,
    '--dna-ink': fit(at(dark ? 0.93 : 0.24, Math.min(tint, 0.015), neutral), body),
    '--dna-muted': fit(at(dark ? 0.8 : 0.42, Math.min(tint * 1.5, 0.03), neutral), body),
    '--dna-accent': fit(at(dark ? 0.78 : 0.5, chroma, hue), ui),
    '--dna-accent-2': fit(at(dark ? 0.74 : 0.48, chroma * 0.85, wrapHue(p.secondaryHue)), ui),
    '--dna-border': oklchToHex(at(dark ? 0.38 : 0.82, Math.min(chroma * 0.4, 0.05), hue)),
    // Semantic hues lean 10% toward the book's warmth-shifted neutral so badges feel native.
    '--dna-warn': fit(at(dark ? 0.8 : 0.5, 0.15, lerpHue(65, neutral, 0.1)), ui),
    '--dna-ok': fit(at(dark ? 0.8 : 0.48, 0.14, lerpHue(150, neutral, 0.1)), ui),
  };
  const border = colors['--dna-border'];
  // Redaction bars: deep ink on light; on dark a depressed obsidian strictly below the surface
  // (never a near-white highlighter) with a 1 px border and a faint censor hatch.
  const redactBg = oklchToHex(
    dark ? at(0.11, 0.01, hue) : at(0.2, Math.min(tint, 0.01), neutral),
  );
  // Soft Page Harmony: a page ground barely tinted by the book (the reader's Aa choice wins).
  const pageBg = oklchToHex(
    dark
      ? at(0.095, Math.min(chroma * 0.18, 0.015), neutral)
      : at(0.968, Math.min(chroma * 0.15, 0.012), neutral),
  );

  const [ease, durScale] = EASE[dna.motion.personality];
  const tempo = clampNum(dna.motion.tempo, 0.5, 2);
  const tokens: Record<string, string> = {
    ...colors,
    '--dna-font-display': FONT_STACKS[dna.typography.display],
    '--dna-font-prose': FONT_STACKS[dna.typography.prose],
    '--dna-font-diegetic': FONT_STACKS[dna.typography.diegetic],
    '--dna-tracking': { tight: '-0.01em', normal: '0em', wide: '0.06em' }[dna.typography.tracking],
    '--dna-radius': { sharp: '2px', soft: '10px', pill: '999px' }[dna.ornament.radius],
    '--dna-stroke': `${clampNum(dna.ornament.strokeWidth, 0.5, 4)}px`,
    '--dna-tempo': String(tempo),
    '--dna-ease': ease,
    '--dna-dur': `${Math.round((320 * durScale) / tempo)}ms`,
    '--dna-grain': String(clampNum(dna.surface.grainIntensity, 0, 1)),
    '--dna-atmos': String(clampNum(dna.atmosphere.intensity, 0, 1)),
    '--dna-redact-bg': redactBg,
    '--dna-redact-border': dark ? border : 'transparent',
    '--dna-redact-hatch': dark
      ? `repeating-linear-gradient(-45deg,color-mix(in srgb,${border} 38%,transparent) 0 1px,transparent 1px 6px)`
      : 'none',
    '--dna-page-bg': pageBg,
    '--dna-page-font': FONT_STACKS[dna.typography.prose],
  };
  return {
    theme,
    colors,
    tokens,
    surface: dna.surface,
    ornament: dna.ornament,
    motion: { ...dna.motion, tempo },
    atmosphere: dna.atmosphere,
    sonic: { ...dna.sonic, gain: clampNum(dna.sonic.gain, 0, 1) },
  };
}
