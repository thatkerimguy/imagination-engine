import { describe, expect, it } from 'vitest';
import { drumHits } from './hits.ts';
import { DEMUCS } from './model.ts';
import { modelInput, reflectPad, segmentStarts, segmentWeight, stemOutput } from './spec.ts';

const S = DEMUCS.segment;

describe('reflectPad', () => {
  it('mirrors without repeating the edge sample', () => {
    expect([...reflectPad(Float32Array.from([1, 2, 3]), 2, 2)]).toEqual([3, 2, 1, 2, 3, 2, 1]);
  });
});

describe('the Demucs spectrogram', () => {
  it('has the shapes the export expects', () => {
    const { waveform, spec } = modelInput(new Float32Array(1000), new Float32Array(1000));
    expect(waveform.length).toBe(2 * S);
    expect(spec.length).toBe(4 * DEMUCS.bins * DEMUCS.frames);
  });

  it('comes back to the same sound through the way out (an identity mask)', () => {
    const left = new Float32Array(S);
    const right = new Float32Array(S);
    for (let i = 0; i < S; i++) {
      left[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / DEMUCS.sampleRate);
      right[i] = 0.3 * Math.sin((2 * Math.PI * 97 * i) / DEMUCS.sampleRate + 1);
    }
    const { spec } = modelInput(left, right);
    // One "track" whose frequency branch is the input and whose time branch is silent.
    const out = stemOutput(spec, new Float32Array(2 * S), 0);
    let worst = 0;
    // The two silent frames at each end soften the very edges, as in Demucs itself.
    for (let i = 8192; i < S - 8192; i += 7) {
      worst = Math.max(worst, Math.abs((out.left[i] ?? 0) - (left[i] ?? 0)));
      worst = Math.max(worst, Math.abs((out.right[i] ?? 0) - (right[i] ?? 0)));
    }
    expect(worst).toBeLessThan(1e-3);
  }, 30_000);
});

describe('segments', () => {
  it('cover a song with a quarter overlap', () => {
    const starts = segmentStarts(S * 2);
    expect(starts[1]).toBe(Math.floor(S * 0.75));
    expect((starts.at(-1) ?? 0) + S).toBeGreaterThanOrEqual(S * 2);
    expect(segmentStarts(0)).toEqual([0]);
  });

  it('fade in and out and are flat in the middle', () => {
    expect(segmentWeight(0)).toBe(0);
    expect(segmentWeight(Math.floor(S / 2))).toBe(1);
    expect(segmentWeight(S)).toBe(0);
  });
});

describe('drumHits', () => {
  it('finds clicks in a drum stem and merges a flam', () => {
    const rate = 44100;
    const samples = new Float32Array(rate * 3);
    const at = [0.5, 1.0, 1.02, 1.5, 2.25];
    for (const t of at)
      for (let i = 0; i < 600; i++) samples[Math.floor(t * rate) + i] = Math.exp(-i / 120);
    const hits = drumHits(samples, rate);
    expect(hits).toHaveLength(4);
    for (const [i, t] of [0.5, 1.0, 1.5, 2.25].entries())
      expect(Math.abs((hits[i] ?? 0) - t)).toBeLessThan(0.02);
  });

  it('finds nothing in silence', () => {
    expect(drumHits(new Float32Array(44100), 44100)).toEqual([]);
  });
});
