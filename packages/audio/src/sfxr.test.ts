import { sfxrParamsSchema } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { renderSfxr, SFXR_DEFAULTS, SFXR_RATE } from './sfxr.ts';
import { generateSfxr, mutateSfxr, SFXR_PRESETS } from './sfxr-presets.ts';

/** A small seeded generator, so presets and noise are repeatable. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const peak = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe('sfxr', () => {
  it('renders the default blip as a short, audible, bounded sound', () => {
    const out = renderSfxr(SFXR_DEFAULTS);
    const seconds = out.length / SFXR_RATE;
    expect(seconds).toBeGreaterThan(0.2);
    expect(seconds).toBeLessThan(1);
    expect(peak(out)).toBeGreaterThan(0.1);
    expect(peak(out)).toBeLessThanOrEqual(1);
  });

  it('is repeatable with a fixed noise source', () => {
    const p = { ...SFXR_DEFAULTS, wave: 'noise' as const };
    expect(renderSfxr(p, seeded(1))).toEqual(renderSfxr(p, seeded(1)));
  });

  it('makes valid, audible sounds from every preset', () => {
    for (const kind of SFXR_PRESETS) {
      for (let seed = 1; seed <= 20; seed++) {
        const params = generateSfxr(kind, seeded(seed * 31 + kind.length));
        expect(sfxrParamsSchema.safeParse(params).success).toBe(true);
        const out = renderSfxr(params, seeded(seed));
        expect(out.length, `${kind} #${seed}`).toBeGreaterThan(100);
        expect(Number.isFinite(peak(out))).toBe(true);
      }
    }
  });

  it('gives story sounds their own length: a click is short, thunder rolls on', () => {
    const seconds = (kind: Parameters<typeof generateSfxr>[0]) =>
      renderSfxr(generateSfxr(kind, seeded(5)), seeded(6)).length / SFXR_RATE;
    expect(seconds('click')).toBeLessThan(0.1);
    expect(seconds('footstep')).toBeLessThan(0.3);
    expect(seconds('thunder')).toBeGreaterThan(1.2);
    expect(seconds('thunder')).toBeLessThan(6);
  });

  it('mutates within range', () => {
    const p = mutateSfxr(generateSfxr('laser', seeded(3)), seeded(4));
    expect(sfxrParamsSchema.safeParse(p).success).toBe(true);
  });
});

describe('procedural drums', () => {
  it('render finite, audible, short voices', async () => {
    const { renderDrums } = await import('./procedural.ts');
    const drums = renderDrums();
    for (const [name, samples] of Object.entries(drums)) {
      expect(samples.length, name).toBeGreaterThan(500);
      expect(samples.every(Number.isFinite), name).toBe(true);
      const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(peak, name).toBeGreaterThan(0.05);
      expect(peak, name).toBeLessThanOrEqual(1);
    }
  });
});
