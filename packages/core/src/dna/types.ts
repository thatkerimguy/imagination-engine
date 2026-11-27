// Book Visual DNA: a 7-axis per-book identity so identical blueprints look different per book.
// Pure data. `resolveVisualDna` turns it into contrast-safe CSS tokens for a theme.

export const FONT_VOICES = [
  'serif-editorial',
  'serif-antique',
  'sans-clean',
  'sans-condensed',
  'mono-terminal',
  'mono-typewriter',
] as const;
export const TRACKINGS = ['tight', 'normal', 'wide'] as const;
export const SURFACE_MATERIALS = [
  'clean',
  'paper-grain',
  'parchment',
  'crt-glass',
  'brushed-metal',
  'linen',
  'newsprint',
] as const;
export const ORNAMENT_GRAMMARS = [
  'minimal',
  'cyber-brackets',
  'deco-corners',
  'parchment-filigree',
  'dossier-stamp',
  'rune-notch',
  'torn-edge',
  'chamfer-tech',
] as const;
export const RADII = ['sharp', 'soft', 'pill'] as const;
export const MOTION_PERSONALITIES = [
  'crisp',
  'mechanical',
  'organic',
  'cinematic',
  'still',
] as const;
export const ATMOSPHERES = [
  'none',
  'subtle-vignette',
  'scanline-mist',
  'warm-glow',
  'ink-edge',
] as const;
export const SONIC_TIMBRES = [
  'silent',
  'synth-cold',
  'acoustic-warm',
  'mechanical-click',
  'ethereal',
] as const;

export type FontVoice = (typeof FONT_VOICES)[number];
export type Tracking = (typeof TRACKINGS)[number];
export type SurfaceMaterial = (typeof SURFACE_MATERIALS)[number];
export type OrnamentGrammar = (typeof ORNAMENT_GRAMMARS)[number];
export type Radius = (typeof RADII)[number];
export type MotionPersonality = (typeof MOTION_PERSONALITIES)[number];
export type AtmosphereStyle = (typeof ATMOSPHERES)[number];
export type SonicTimbre = (typeof SONIC_TIMBRES)[number];
export type DnaTheme = 'dark' | 'light';

export interface BookVisualDna {
  /** Hues in degrees (0-360), chroma in OKLCH units (0-0.37), warmth -1 (cool) .. 1 (warm). */
  palette: {
    hue: number;
    chroma: number;
    warmth: number;
    secondaryHue: number;
    contrastMode: 'balanced' | 'high';
  };
  typography: { display: FontVoice; prose: FontVoice; diegetic: FontVoice; tracking: Tracking };
  /** grainIntensity 0..1. */
  surface: { material: SurfaceMaterial; grainIntensity: number };
  /** strokeWidth in CSS px (0.5..4). */
  ornament: { grammar: OrnamentGrammar; radius: Radius; strokeWidth: number };
  /** tempo multiplier 0.5 (slow) .. 2 (fast). */
  motion: { personality: MotionPersonality; tempo: number };
  /** intensity 0..1. */
  atmosphere: { style: AtmosphereStyle; intensity: number };
  /** gain 0..1. */
  sonic: { timbre: SonicTimbre; gain: number };
}

export const DNA_COLOR_TOKENS = [
  '--dna-bg',
  '--dna-surface',
  '--dna-surface-alt',
  '--dna-ink',
  '--dna-muted',
  '--dna-accent',
  '--dna-accent-2',
  '--dna-border',
  '--dna-warn',
  '--dna-ok',
] as const;

export type DnaColorToken = (typeof DNA_COLOR_TOKENS)[number];

/** Output of `resolveVisualDna`: hex colours plus the non-colour axes, ready for CSS. */
export interface ResolvedVisualDna {
  theme: DnaTheme;
  colors: Record<DnaColorToken, string>;
  /** Every CSS custom property to set on the reading root (colours, fonts, shape, motion). */
  tokens: Record<string, string>;
  surface: BookVisualDna['surface'];
  ornament: BookVisualDna['ornament'];
  motion: BookVisualDna['motion'];
  atmosphere: BookVisualDna['atmosphere'];
  sonic: BookVisualDna['sonic'];
}
