import type { DiceMaterial } from './schema.ts';

export interface Finish {
  body: string;
  pip: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  grain: number;
}

export const FINISHES: Record<DiceMaterial, Finish> = {
  // Warm, slightly dark albedo so ACES tone mapping keeps bevels and face planes readable.
  ivory: {
    body: '#e6dfd1',
    pip: '#1d1a17',
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.2,
    grain: 0.05,
  },
  'casino-red': {
    body: '#a3071c',
    pip: '#f7f3ea',
    roughness: 0.16,
    metalness: 0,
    clearcoat: 1,
    grain: 0,
  },
  brass: {
    body: '#c39a45',
    pip: '#2a1c07',
    roughness: 0.34,
    metalness: 1,
    clearcoat: 0,
    grain: 0.08,
  },
  obsidian: {
    body: '#121216',
    pip: '#d9c48f',
    roughness: 0.1,
    metalness: 0,
    clearcoat: 1,
    grain: 0,
  },
};
