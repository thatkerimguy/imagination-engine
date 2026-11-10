import { extractChroma } from './chroma.ts';
import { FFT, hann } from './fft.ts';

/** Frame-level features of a mono signal. Frame `t` is centred on sample `t * hop`. */
export interface Features {
  readonly sampleRate: number;
  readonly hop: number;
  /** Frames per second. */
  readonly fps: number;
  readonly frames: number;
  /** Spectral flux over all mel bands: how much new energy each frame brings. */
  readonly onset: Float32Array;
  /** Spectral flux below ~180 Hz: kick drums and bass notes, which mark downbeats. */
  readonly lowOnset: Float32Array;
  /** 12 whitened pitch-class strengths per frame (signed; noise averages to 0), `chroma[t * 12 + pc]`. */
  readonly chroma: Float32Array;
  /** Root-mean-square level per frame. */
  readonly rms: Float32Array;
}

export interface FeatureOptions {
  readonly fftSize?: number;
  /** Target frames per second (the hop is rounded to whole samples). */
  readonly fps?: number;
  readonly mels?: number;
}

const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
const melToHz = (mel: number) => 700 * (10 ** (mel / 2595) - 1);

interface Band {
  readonly start: number;
  readonly weights: Float32Array;
}

/** Triangular mel filters over FFT bins. */
export function melBands(
  sampleRate: number,
  fftSize: number,
  count: number,
  fmin: number,
  fmax: number,
): Band[] {
  const binHz = sampleRate / fftSize;
  const lo = hzToMel(fmin);
  const hi = hzToMel(Math.min(fmax, sampleRate / 2));
  const edges = Array.from({ length: count + 2 }, (_, i) =>
    melToHz(lo + ((hi - lo) * i) / (count + 1)),
  );
  const bands: Band[] = [];
  for (let m = 0; m < count; m++) {
    const [left, centre, right] = [edges[m] ?? 0, edges[m + 1] ?? 0, edges[m + 2] ?? 0];
    const start = Math.max(1, Math.floor(left / binHz));
    const end = Math.max(start + 1, Math.ceil(right / binHz));
    const weights = new Float32Array(end - start);
    for (let k = start; k < end; k++) {
      const f = k * binHz;
      const w = f <= centre ? (f - left) / (centre - left) : (right - f) / (right - centre);
      weights[k - start] = Math.max(0, w);
    }
    bands.push({ start, weights });
  }
  return bands;
}

export function extractFeatures(
  samples: Float32Array,
  sampleRate: number,
  options: FeatureOptions = {},
): Features {
  const fftSize = options.fftSize ?? (sampleRate > 32000 ? 2048 : 1024);
  const hop = Math.max(1, Math.round(sampleRate / (options.fps ?? 100)));
  const frames = Math.max(1, Math.ceil(samples.length / hop));
  const fft = new FFT(fftSize);
  const window = hann(fftSize);
  const bands = melBands(sampleRate, fftSize, options.mels ?? 64, 30, 8000);
  const lowBands = bands.filter((b) => (b.start * sampleRate) / fftSize < 180).length;

  const onset = new Float32Array(frames);
  const lowOnset = new Float32Array(frames);
  const rms = new Float32Array(frames);
  const frame = new Float32Array(fftSize);
  const power = new Float32Array(fftSize / 2 + 1);
  let previous = new Float32Array(bands.length);
  let current = new Float32Array(bands.length);

  for (let t = 0; t < frames; t++) {
    // Centred frames: the window around sample t * hop, zero-padded at the edges.
    const origin = t * hop - fftSize / 2;
    let energy = 0;
    for (let i = 0; i < fftSize; i++) {
      const s = samples[origin + i] ?? 0;
      energy += s * s;
      frame[i] = s * (window[i] ?? 0);
    }
    rms[t] = Math.sqrt(energy / fftSize);
    fft.power(frame, power);

    for (let m = 0; m < bands.length; m++) {
      const band = bands[m];
      if (!band) continue;
      let sum = 0;
      for (let i = 0; i < band.weights.length; i++)
        sum += (power[band.start + i] ?? 0) * (band.weights[i] ?? 0);
      // Log compression makes quiet and loud passages count alike.
      current[m] = Math.log1p(1000 * sum);
    }
    if (t > 0) {
      let flux = 0;
      let low = 0;
      for (let m = 0; m < bands.length; m++) {
        const rise = (current[m] ?? 0) - (previous[m] ?? 0);
        if (rise > 0) {
          flux += rise;
          if (m < lowBands) low += rise;
        }
      }
      onset[t] = flux;
      lowOnset[t] = low;
    }
    [previous, current] = [current, previous];
  }
  const chroma = extractChroma(samples, sampleRate, hop, frames);
  return { sampleRate, hop, fps: sampleRate / hop, frames, onset, lowOnset, chroma, rms };
}

/** Removes the local average (about half a second) and negative parts, then scales to 0..1. */
export function normalizeOnset(onset: Float32Array, fps: number): Float32Array {
  const radius = Math.max(1, Math.round(fps * 0.25));
  const out = new Float32Array(onset.length);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < Math.min(radius, onset.length); i++) {
    sum += onset[i] ?? 0;
    count++;
  }
  let max = 0;
  for (let t = 0; t < onset.length; t++) {
    const add = t + radius;
    if (add < onset.length) {
      sum += onset[add] ?? 0;
      count++;
    }
    const drop = t - radius - 1;
    if (drop >= 0) {
      sum -= onset[drop] ?? 0;
      count--;
    }
    const v = Math.max(0, (onset[t] ?? 0) - sum / count);
    out[t] = v;
    if (v > max) max = v;
  }
  if (max > 0) for (let t = 0; t < out.length; t++) out[t] = (out[t] ?? 0) / max;
  return out;
}
