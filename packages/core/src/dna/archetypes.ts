// Six starter Book Visual DNA archetypes. Each one is a full 7-axis identity, so the same
// blueprint reads as a different book under each.
import type { BookVisualDna } from './types.ts';

export const DNA_ARCHETYPE_IDS = [
  'noir-rain',
  'holographic-system',
  'antique-parchment',
  'classified-dossier',
  'editorial-minimal',
  'celestial-ink',
] as const;

export type DnaArchetypeId = (typeof DNA_ARCHETYPE_IDS)[number];

export const DNA_ARCHETYPE_NAMES: Record<DnaArchetypeId, string> = {
  'noir-rain': 'Noir Rain',
  'holographic-system': 'Holographic System',
  'antique-parchment': 'Antique Parchment',
  'classified-dossier': 'Classified Dossier',
  'editorial-minimal': 'Editorial Minimal',
  'celestial-ink': 'Celestial Ink',
};

export const DNA_ARCHETYPES: Record<DnaArchetypeId, BookVisualDna> = {
  'noir-rain': {
    palette: { hue: 190, chroma: 0.11, warmth: -0.4, secondaryHue: 330, contrastMode: 'balanced' },
    typography: { display: 'sans-condensed', prose: 'serif-editorial', diegetic: 'mono-terminal', tracking: 'wide' },
    surface: { material: 'crt-glass', grainIntensity: 0.35 },
    ornament: { grammar: 'cyber-brackets', radius: 'sharp', strokeWidth: 1.5 },
    motion: { personality: 'cinematic', tempo: 0.9 },
    atmosphere: { style: 'scanline-mist', intensity: 0.4 },
    sonic: { timbre: 'synth-cold', gain: 0.5 },
  },
  'holographic-system': {
    palette: { hue: 265, chroma: 0.17, warmth: -0.6, secondaryHue: 175, contrastMode: 'balanced' },
    typography: { display: 'sans-clean', prose: 'sans-clean', diegetic: 'mono-terminal', tracking: 'wide' },
    surface: { material: 'clean', grainIntensity: 0 },
    ornament: { grammar: 'cyber-brackets', radius: 'soft', strokeWidth: 1 },
    motion: { personality: 'crisp', tempo: 1.3 },
    atmosphere: { style: 'subtle-vignette', intensity: 0.3 },
    sonic: { timbre: 'ethereal', gain: 0.45 },
  },
  'antique-parchment': {
    palette: { hue: 55, chroma: 0.09, warmth: 0.8, secondaryHue: 20, contrastMode: 'balanced' },
    typography: {
      display: 'serif-antique',
      prose: 'serif-editorial',
      diegetic: 'serif-editorial',
      tracking: 'normal',
    },
    surface: { material: 'parchment', grainIntensity: 0.6 },
    ornament: { grammar: 'parchment-filigree', radius: 'soft', strokeWidth: 1.25 },
    motion: { personality: 'organic', tempo: 0.8 },
    atmosphere: { style: 'warm-glow', intensity: 0.45 },
    sonic: { timbre: 'acoustic-warm', gain: 0.5 },
  },
  'classified-dossier': {
    palette: { hue: 25, chroma: 0.13, warmth: 0.2, secondaryHue: 95, contrastMode: 'high' },
    typography: {
      display: 'serif-antique',
      prose: 'serif-editorial',
      diegetic: 'mono-typewriter',
      tracking: 'normal',
    },
    surface: { material: 'paper-grain', grainIntensity: 0.45 },
    ornament: { grammar: 'dossier-stamp', radius: 'sharp', strokeWidth: 2 },
    motion: { personality: 'mechanical', tempo: 1 },
    atmosphere: { style: 'ink-edge', intensity: 0.35 },
    sonic: { timbre: 'mechanical-click', gain: 0.55 },
  },
  'editorial-minimal': {
    palette: { hue: 240, chroma: 0.05, warmth: 0, secondaryHue: 20, contrastMode: 'balanced' },
    typography: { display: 'sans-clean', prose: 'serif-editorial', diegetic: 'sans-clean', tracking: 'tight' },
    surface: { material: 'clean', grainIntensity: 0 },
    ornament: { grammar: 'minimal', radius: 'soft', strokeWidth: 1 },
    motion: { personality: 'crisp', tempo: 1 },
    atmosphere: { style: 'none', intensity: 0 },
    sonic: { timbre: 'silent', gain: 0 },
  },
  'celestial-ink': {
    palette: { hue: 285, chroma: 0.12, warmth: -0.2, secondaryHue: 80, contrastMode: 'balanced' },
    typography: {
      display: 'serif-antique',
      prose: 'sans-clean',
      diegetic: 'serif-editorial',
      tracking: 'wide',
    },
    surface: { material: 'linen', grainIntensity: 0.3 },
    ornament: { grammar: 'rune-notch', radius: 'pill', strokeWidth: 1.25 },
    motion: { personality: 'organic', tempo: 0.7 },
    atmosphere: { style: 'subtle-vignette', intensity: 0.5 },
    sonic: { timbre: 'ethereal', gain: 0.4 },
  },
};

export const isDnaArchetypeId = (v: unknown): v is DnaArchetypeId =>
  typeof v === 'string' && (DNA_ARCHETYPE_IDS as readonly string[]).includes(v);
