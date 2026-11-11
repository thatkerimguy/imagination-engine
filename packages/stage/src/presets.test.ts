import { STAGE_BACKGROUNDS, STAGE_BURSTS, STAGE_LOOKS, STAGE_TRANSITIONS } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { AMBIENTS } from './ambients.ts';
import { COVER, LOOKS, overlayUniforms } from './looks.ts';
import { PARTICLE_PRESETS } from './particles.ts';

describe('stage presets', () => {
  it('have a stage effect for every preset a story can name', () => {
    for (const b of STAGE_BACKGROUNDS) if (b !== 'none') expect(AMBIENTS[b], b).toBeDefined();
    for (const l of STAGE_LOOKS) expect(LOOKS[l], l).toBeDefined();
    for (const p of STAGE_BURSTS) expect(PARTICLE_PRESETS[p], p).toBeDefined();
    const kinds = STAGE_TRANSITIONS.map((k) => COVER[k]);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('keep backgrounds gentle enough for the reference phone', () => {
    // PLAN §11.1: 3,000 particles in all. A background lives at most rate × life.
    for (const [name, a] of Object.entries(AMBIENTS))
      expect(a.rate * a.spec.life[1], name).toBeLessThanOrEqual(200);
  });

  it('tint coloured looks with their own colour', () => {
    const still = {
      offsetX: 0,
      offsetY: 0,
      angle: 0,
      zoom: 0,
      flash: [1, 1, 1] as const,
      flashAmount: 0,
      timeScale: 1,
    };
    const u = overlayUniforms('sepia', still, null, [0, 0, 1], true);
    expect(u.tint[0]).toBeCloseTo(0.55 * 0.16);
    expect(u.tint[2]).toBeCloseTo(0.16 * 0.16);
    expect(u.tint[3]).toBeCloseTo(0.16);
  });
});
