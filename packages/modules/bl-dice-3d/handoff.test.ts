import { describe, expect, it } from 'vitest';
import { FADE_SECONDS, fadeProgress, shadowFor } from './handoff.ts';

describe('handoff curves', () => {
  it('fades from 0 to 1 over FADE_SECONDS', () => {
    expect(fadeProgress(1, 1)).toBe(0);
    expect(fadeProgress(1 + FADE_SECONDS / 2, 1)).toBeCloseTo(0.5);
    expect(fadeProgress(1 + FADE_SECONDS * 2, 1)).toBe(1);
  });

  it('softens and fades shadows as dice rise', () => {
    const ground = shadowFor(0);
    const air = shadowFor(2);
    expect(air.opacity).toBeLessThan(ground.opacity / 3);
    expect(air.scale).toBeGreaterThan(ground.scale);
    expect(air.offset).toBeGreaterThan(ground.offset);
    expect(shadowFor(-0.1)).toEqual(ground);
  });
});
