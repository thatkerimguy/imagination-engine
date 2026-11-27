// Dice finishes (ported from the archived v1 bl-dice-3d module).
export type DiceMaterial = 'ivory' | 'casino-red' | 'brass' | 'obsidian';
export const DICE_MATERIALS: readonly DiceMaterial[] = ['ivory', 'casino-red', 'brass', 'obsidian'];

export interface Finish {
  body: string;
  pip: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  envMapIntensity: number;
  grain: number;
}

// Tuned on a real phone: every finish keeps the flat +Z top face from mirroring the overhead
// light into the camera, so pips stay readable once the dice settle.
export const FINISHES: Record<DiceMaterial, Finish> = {
  // Warm, slightly dark albedo so ACES tone mapping keeps bevels and face planes readable.
  ivory: {
    body: '#e6dfd1',
    pip: '#1d1a17',
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.28,
    envMapIntensity: 0.48,
    grain: 0.05,
  },
  'casino-red': {
    body: '#920a1c',
    pip: '#f7f3ea',
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.38,
    clearcoatRoughness: 0.26,
    envMapIntensity: 0.45,
    grain: 0,
  },
  brass: {
    body: '#c39a45',
    pip: '#231604',
    roughness: 0.38,
    metalness: 0.88,
    clearcoat: 0,
    clearcoatRoughness: 0.35,
    envMapIntensity: 0.82,
    grain: 0.08,
  },
  obsidian: {
    body: '#141419',
    pip: '#dfc98f',
    roughness: 0.22,
    metalness: 0,
    clearcoat: 0.48,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.55,
    grain: 0,
  },
};
