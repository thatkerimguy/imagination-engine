import { describe, expect, it } from 'vitest';
import { analyzeSamples } from './analyze.ts';

const SR = 22050;

/** A tiny repeatable random source. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
}

/**
 * Piano-like chords (six decaying harmonics, bass included), each struck four times, over pink
 * noise. Harmonics put real weight on each note's fifth, which once pulled C major towards G.
 */
function piano(chords: readonly (readonly number[])[], seconds: number, noise: number) {
  const out = new Float32Array(SR * seconds);
  const each = seconds / chords.length;
  chords.forEach((notes, c) => {
    for (let strike = 0; strike < 4; strike++) {
      const start = Math.round((c + strike / 4) * each * SR);
      for (const midi of notes) {
        const f = 440 * 2 ** ((midi - 69) / 12);
        for (let i = 0; i < (each / 4) * SR && start + i < out.length; i++) {
          const t = i / SR;
          let v = 0;
          for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * f * h * t) / h ** 1.5;
          out[start + i] = (out[start + i] ?? 0) + 0.08 * v * Math.exp(-t * 3);
        }
      }
    }
  });
  const white = lcg(11);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = white();
    b0 = 0.99765 * b0 + w * 0.099;
    b1 = 0.963 * b1 + w * 0.2965;
    b2 = 0.57 * b2 + w * 1.0526;
    out[i] = (out[i] ?? 0) + noise * 0.2 * (b0 + b1 + b2 + w * 0.1848);
  }
  return out;
}

describe('key', () => {
  it('names the key of chord progressions, bass and harmonics included', () => {
    const cMajor = [
      [48, 60, 64, 67],
      [53, 57, 60, 65],
      [55, 59, 62, 67],
      [48, 60, 64, 67],
    ];
    const aMinor = [
      [45, 57, 60, 64],
      [50, 53, 57, 62],
      [52, 56, 59, 64],
      [45, 57, 60, 64],
    ];
    const dMajor = [
      [50, 62, 66, 69],
      [55, 59, 62, 67],
      [57, 61, 64, 69],
      [50, 62, 66, 69],
    ];
    expect(analyzeSamples(piano(cMajor, 16, 0.3), SR).key).toEqual({ tonic: 0, mode: 'major' });
    expect(analyzeSamples(piano(aMinor, 16, 0.3), SR).key).toEqual({ tonic: 9, mode: 'minor' });
    expect(analyzeSamples(piano(dMajor, 16, 0), SR).key).toEqual({ tonic: 2, mode: 'major' });
  });

  it('names no key for noise or drums', () => {
    const white = lcg(5);
    expect(analyzeSamples(Float32Array.from({ length: SR * 8 }, white), SR).key).toBeUndefined();
    const drums = new Float32Array(SR * 10);
    const hiss = lcg(9);
    for (let b = 0; b < 16; b++) {
      const start = Math.round(b * 0.6 * SR);
      for (let i = 0; i < 0.2 * SR; i++) {
        const t = i / SR;
        drums[start + i] =
          (drums[start + i] ?? 0) +
          Math.sin(2 * Math.PI * 60 * t) * Math.exp(-t * 18) +
          hiss() * Math.exp(-t * 40) * 0.4;
      }
    }
    expect(analyzeSamples(drums, SR).key).toBeUndefined();
  });
});
