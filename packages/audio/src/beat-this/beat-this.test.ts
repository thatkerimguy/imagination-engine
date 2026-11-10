import { describe, expect, it } from 'vitest';
import { aggregate, windowAt, windowStarts } from './chunks.ts';
import { trackDownbeats } from './dbn.ts';
import { logMelSpectrogram } from './melspec.ts';
import { BEAT_THIS } from './model.ts';

describe('Beat This! windows', () => {
  it('lays windows out like the reference', () => {
    // Shorter than one window's middle: a single window starting in the padding.
    expect(windowStarts(1000)).toEqual([-6]);
    // 3000 frames: steps of 1488, the last moved back to end at the piece's end.
    expect(windowStarts(3000)).toEqual([-6, 1482, 1506]);
  });

  it('pads windows with silence outside the piece', () => {
    const mels = 2;
    const spect = Float32Array.from({ length: 10 * mels }, (_, i) => i + 1);
    const w = windowAt(spect, 10, -3, mels, 8);
    expect([...w]).toEqual([0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('keeps the earlier window where windows overlap, without borders', () => {
    const a = new Float32Array(10).fill(1);
    const b = new Float32Array(10).fill(2);
    // a keeps frames 0..5, b keeps 6..11; frame 12 is beyond both.
    const out = aggregate([a, b], [-2, 4], 13, 10, 2);
    expect([...out]).toEqual([1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, -1000]);
    // Where they overlap, the earlier window wins.
    expect([...aggregate([a, b], [-2, 2], 10, 10, 2)].slice(0, 7)).toEqual([1, 1, 1, 1, 1, 1, 2]);
  });
});

describe('Beat This! spectrogram', () => {
  it('has one frame per hop plus one, and puts a tone in the band that holds it', () => {
    const { nFft, mels, sampleRate } = BEAT_THIS;
    const bins = nFft / 2 + 1;
    // A toy filterbank: band j covers bins 4j..4j+3.
    const fb = new Float32Array(bins * mels);
    for (let k = 0; k < bins; k++) {
      const j = Math.floor(k / 4);
      if (j < mels) fb[k * mels + j] = 1;
    }
    const samples = new Float32Array(sampleRate);
    const bin = 41; // 41 * 22050 / 1024 ≈ 883 Hz
    for (let i = 0; i < samples.length; i++)
      samples[i] = Math.sin((2 * Math.PI * bin * sampleRate * i) / nFft / sampleRate);
    const { frames, data } = logMelSpectrogram(samples, fb);
    expect(frames).toBe(1 + Math.floor(sampleRate / 441));
    const row = data.subarray(25 * mels, 26 * mels);
    const loudest = row.indexOf(Math.max(...row));
    expect(loudest).toBe(Math.floor(bin / 4));
  });
});

describe('Beat This! DBN', () => {
  /** Logits with a beat every `period` frames and a downbeat every `bar` beats. */
  function activations(frames: number, period: number, bar: number, offset = 0) {
    const beat = new Float32Array(frames).fill(-6);
    const down = new Float32Array(frames).fill(-6);
    for (let n = 0, t = offset; t < frames; n++, t += period) {
      beat[t] = 6;
      if (n % bar === 0) down[t] = 6;
    }
    return { beat, down };
  }

  it('finds the beats and bars of a steady 4/4', () => {
    // 120 BPM at 50 fps: a beat every 25 frames, starting on a downbeat at frame 10.
    const { beat, down } = activations(1500, 25, 4, 10);
    const result = trackDownbeats(beat, down);
    expect(result.beatsPerBar).toBe(4);
    expect(result.beats.slice(0, 5)).toEqual([10, 35, 60, 85, 110]);
    expect(result.numbers.slice(0, 5)).toEqual([1, 2, 3, 4, 1]);
  });

  it('tells 3/4 from 4/4', () => {
    const { beat, down } = activations(1500, 30, 3, 0);
    const result = trackDownbeats(beat, down);
    expect(result.beatsPerBar).toBe(3);
    expect(result.numbers.slice(0, 4)).toEqual([1, 2, 3, 1]);
  });

  it('keeps the tempo through a gap where the network is unsure', () => {
    const { beat, down } = activations(2000, 25, 4, 0);
    // Two seconds with nothing detected.
    beat.fill(-6, 800, 900);
    down.fill(-6, 800, 900);
    const result = trackDownbeats(beat, down);
    const gap = result.beats.filter((t) => t > 790 && t < 910);
    expect(gap).toEqual([800, 825, 850, 875, 900]);
  });
});
