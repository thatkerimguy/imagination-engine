import { describe, expect, it } from 'vitest';
import { analyzeSamples } from './analyze.ts';
import { FFT } from './fft.ts';
import { peakPerBeat } from './harmony.ts';

const SR = 22050;

/** A short decaying tone burst, like a drum hit. */
function hit(out: Float32Array, at: number, freq: number, gain: number, length = 0.12): void {
  const start = Math.round(at * SR);
  const n = Math.round(length * SR);
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SR;
    out[start + i] =
      (out[start + i] ?? 0) + gain * Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 30);
  }
}

/** A click track: a deep accent on each bar's first beat and lighter clicks on the others. */
function clickTrack(bpm: number, beatsPerBar: number, seconds: number, lead = 0.3): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  const beat = 60 / bpm;
  for (let i = 0; lead + i * beat < seconds - 0.2; i++) {
    const t = lead + i * beat;
    if (i % beatsPerBar === 0) hit(out, t, 60, 0.9, 0.2);
    hit(out, t, 1800, 0.35);
  }
  return out;
}

/** Sustained notes of a scale, for the key estimate. */
function melody(notes: readonly number[], seconds: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  const each = seconds / notes.length;
  notes.forEach((midi, k) => {
    const f = 440 * 2 ** ((midi - 69) / 12);
    for (let i = Math.round(k * each * SR); i < Math.round((k + 1) * each * SR); i++)
      out[i] =
        0.3 * Math.sin((2 * Math.PI * f * i) / SR) + 0.15 * Math.sin((4 * Math.PI * f * i) / SR);
  });
  return out;
}

describe('FFT', () => {
  it('matches a direct DFT', () => {
    const n = 16;
    const re = Array.from({ length: n }, (_, i) => Math.sin(i) + 0.3 * Math.cos(3 * i));
    const im = new Array<number>(n).fill(0);
    const out = new FFT(n).complex(re, im);
    for (let k = 0; k < n; k++) {
      let r = 0;
      let j = 0;
      for (let t = 0; t < n; t++) {
        r += (re[t] ?? 0) * Math.cos((-2 * Math.PI * k * t) / n);
        j += (re[t] ?? 0) * Math.sin((-2 * Math.PI * k * t) / n);
      }
      expect(out.re[k]).toBeCloseTo(r, 9);
      expect(out.im[k]).toBeCloseTo(j, 9);
    }
  });
});

describe('chroma', () => {
  it('hears a quiet chord through loud noise', () => {
    // Broadband noise once outweighed the music and pulled every busy track into one key.
    let seed = 3;
    const out = Float32Array.from({ length: SR * 6 }, (_, i) => {
      const noise = ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
      const chord = [220, 261.63, 329.63].reduce(
        (sum, f) => sum + Math.sin((2 * Math.PI * f * i) / SR),
        0,
      );
      return 0.3 * noise + 0.04 * chord;
    });
    expect(analyzeSamples(out, SR).key).toEqual({ tonic: 9, mode: 'minor' });
  });
});

describe('peakPerBeat', () => {
  it('credits an onset that peaks just before its beat to that beat', () => {
    const onset = new Float32Array(40);
    onset[18] = 1; // two frames early for the beat at frame 20
    onset[29] = 0.3;
    expect(Array.from(peakPerBeat(onset, [10, 20, 30], 3))).toEqual([0, 1, 0.30000001192092896]);
  });
});

describe('beat analysis', () => {
  it('finds the tempo, beats and downbeats of a 4/4 click track', () => {
    const a = analyzeSamples(clickTrack(120, 4, 24), SR);
    expect(a.bpm).toBeGreaterThan(119);
    expect(a.bpm).toBeLessThan(121);
    expect(a.tempo).toBe('constant');
    expect(a.beatsPerBar).toBe(4);
    for (let i = 1; i < a.beats.length; i++)
      expect(Math.abs((a.beats[i] ?? 0) - (a.beats[i - 1] ?? 0) - 0.5)).toBeLessThan(0.03);
    // Accented beats sit at 0.3 + 2k seconds.
    for (const d of a.downbeats) {
      const t = a.beats[d] ?? 0;
      const k = Math.round((t - 0.3) / 2);
      expect(Math.abs(t - (0.3 + 2 * k))).toBeLessThan(0.03);
    }
  });

  it('puts downbeats on the accent in a groove that starts on the one', () => {
    // A kick on each bar's first beat, a lighter low drum on the others and off-beat hats: the
    // accent's onset peaks just before its beat, which once shifted every downbeat late.
    const out = new Float32Array(20 * SR);
    const beat = 0.6;
    let seed = 7;
    const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let b = 0; b * beat < 19.5; b++) {
      const at = Math.round(b * beat * SR);
      const accent = b % 4 === 0;
      for (let i = 0; i < 0.15 * SR; i++) {
        const t = i / SR;
        out[at + i] =
          (out[at + i] ?? 0) +
          Math.sin(2 * Math.PI * (accent ? 60 : 180) * t) *
            Math.exp(-t * (accent ? 18 : 30)) *
            (accent ? 0.9 : 0.5) +
          noise() * Math.exp(-t * 80) * 0.3;
      }
      const off = Math.round((b + 0.5) * beat * SR);
      for (let i = 0; i < 0.03 * SR; i++)
        out[off + i] = (out[off + i] ?? 0) + noise() * Math.exp((-i / SR) * 120) * 0.15;
    }
    // A held chord under it, so the bass band is never quiet between hits.
    for (let i = 0; i < out.length; i++)
      out[i] =
        (out[i] ?? 0) +
        0.05 *
          [220, 261.63, 329.63].reduce((sum, f) => sum + Math.sin((2 * Math.PI * f * i) / SR), 0);
    const a = analyzeSamples(out, SR);
    expect(Math.abs(a.bpm - 100)).toBeLessThan(1);
    expect(a.downbeats.length).toBeGreaterThan(3);
    for (const d of a.downbeats) {
      const t = a.beats[d] ?? 0;
      const k = Math.round(t / 2.4);
      expect(Math.abs(t - 2.4 * k)).toBeLessThan(0.04);
    }
  });

  it('handles a slower tempo without doubling it', () => {
    const a = analyzeSamples(clickTrack(92, 4, 24), SR);
    expect(Math.abs(a.bpm - 92)).toBeLessThan(1.5);
  });

  it('hears three beats to the bar in a waltz', () => {
    const a = analyzeSamples(clickTrack(150, 3, 24), SR);
    expect(Math.abs(a.bpm - 150)).toBeLessThan(2);
    expect(a.beatsPerBar).toBe(3);
  });

  it('estimates the key from the pitch profile', () => {
    // C major scale with weight on C, E and G; then A natural minor with weight on A, C and E.
    const c = analyzeSamples(
      melody([60, 64, 67, 60, 62, 64, 65, 67, 69, 71, 72, 67, 64, 60], 7),
      SR,
    );
    expect(c.key).toEqual({ tonic: 0, mode: 'major' });
    const a = analyzeSamples(
      melody([57, 60, 64, 57, 59, 60, 62, 64, 65, 67, 69, 64, 60, 57], 7),
      SR,
    );
    expect(a.key).toEqual({ tonic: 9, mode: 'minor' });
  });
});
