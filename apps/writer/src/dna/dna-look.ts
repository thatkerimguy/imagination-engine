// Pure mapping from resolved Visual DNA to React Native style numbers (no RN import).
import type { Radius } from '@kn/core/dna';

export const radiusDp = (r: Radius, scale = 1): number =>
  Math.round((r === 'sharp' ? 2 : r === 'soft' ? 10 : 20) * scale);

export const hexOk = (v: string | undefined, fallback: string): string =>
  v && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
