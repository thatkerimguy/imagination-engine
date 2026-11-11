import { FFT, hann } from '../dsp/fft.ts';
import { DEMUCS } from './model.ts';

/*
 * The spectrogram HTDemucs expects, and the way back, as the network was trained (its `_spec`
 * and `_ispec`). The export leaves both outside the graph, so they have to match it exactly.
 */

const { segment: S, nFft: N, hop: H, bins: B, frames: F } = DEMUCS;
/** Demucs pads by 1.5 hops before the STFT and drops two frames at each end. */
const PAD = Math.floor(H / 2) * 3;
const PAD_RIGHT = PAD + F * H - S;
/** Where the signal starts in the STFT's input: torch's centre padding, then Demucs' own. */
const OFFSET = N / 2 + PAD;
const STFT_FRAMES = F + 4;
const ISTFT_LENGTH = (STFT_FRAMES - 1) * H + N;

/** numpy-style reflect padding (the edge sample is not repeated). */
export function reflectPad(x: Float32Array, left: number, right: number): Float32Array {
  const n = x.length;
  const out = new Float32Array(n + left + right);
  const at = (i: number): number => {
    // Fold back and forth until the index lands inside; short inputs fold more than once.
    const period = 2 * (n - 1);
    let j = ((i % period) + period) % period;
    if (j >= n) j = period - j;
    return x[j] ?? 0;
  };
  for (let i = 0; i < out.length; i++) out[i] = at(i - left);
  return out;
}

let fft: FFT | null = null;
let window: Float32Array | null = null;
const tools = () => {
  fft ??= new FFT(N);
  window ??= hann(N);
  return { fft, window };
};
const SCALE = 1 / Math.sqrt(N);

/**
 * Writes one channel's spectrogram into `out` at `[re, im]` planes of `B × F` (bin-major), from a
 * segment of exactly `S` samples.
 */
function specInto(x: Float32Array, out: Float32Array, rePlane: number, imPlane: number): void {
  const { fft, window } = tools();
  const padded = reflectPad(reflectPad(x, PAD, PAD_RIGHT), N / 2, N / 2);
  const frame = new Float32Array(N);
  const zero = new Float32Array(N);
  for (let f = 0; f < F; f++) {
    const start = (f + 2) * H;
    for (let i = 0; i < N; i++) frame[i] = (padded[start + i] ?? 0) * (window[i] ?? 0);
    const { re, im } = fft.complex(frame, zero);
    for (let b = 0; b < B; b++) {
      out[rePlane + b * F + f] = (re[b] ?? 0) * SCALE;
      out[imPlane + b * F + f] = (im[b] ?? 0) * SCALE;
    }
  }
}

/** The network's two inputs for one stereo segment (zero-filled to `S`). */
export function modelInput(
  left: Float32Array,
  right: Float32Array,
): { waveform: Float32Array; spec: Float32Array } {
  const l = new Float32Array(S);
  const r = new Float32Array(S);
  l.set(left.subarray(0, S));
  r.set(right.subarray(0, S));
  const waveform = new Float32Array(2 * S);
  waveform.set(l, 0);
  waveform.set(r, S);
  const plane = B * F;
  const spec = new Float32Array(4 * plane);
  specInto(l, spec, 0, plane);
  specInto(r, spec, 2 * plane, 3 * plane);
  return { waveform, spec };
}

/** One channel back to `S` samples from `[re, im]` planes of `B × F` at `offset` in `data`. */
function ispec(data: ArrayLike<number>, rePlane: number, imPlane: number): Float32Array {
  const { fft, window } = tools();
  const out = new Float64Array(ISTFT_LENGTH);
  const norm = new Float64Array(ISTFT_LENGTH);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let t = 0; t < STFT_FRAMES; t++) {
    const start = t * H;
    // The two frames added at each end are silent but still count in the window sum.
    for (let i = 0; i < N; i++) norm[start + i] = (norm[start + i] ?? 0) + (window[i] ?? 0) ** 2;
    const f = t - 2;
    if (f < 0 || f >= F) continue;
    re.fill(0);
    im.fill(0);
    for (let b = 0; b < B; b++) {
      re[b] = data[rePlane + b * F + f] ?? 0;
      im[b] = data[imPlane + b * F + f] ?? 0;
    }
    // Hermitian mirror (the Nyquist bin is zero), conjugated so a forward FFT inverts.
    for (let b = 1; b < N / 2; b++) {
      re[N - b] = re[b] ?? 0;
      im[N - b] = -(im[b] ?? 0);
    }
    for (let b = 0; b < N; b++) im[b] = -(im[b] ?? 0);
    const back = fft.complex(re, im);
    // Inverse FFT divides by N; undoing the forward 1/sqrt(N) multiplies by sqrt(N).
    const gain = Math.sqrt(N) / N;
    for (let i = 0; i < N; i++)
      out[start + i] = (out[start + i] ?? 0) + (back.re[i] ?? 0) * gain * (window[i] ?? 0);
  }
  const result = new Float32Array(S);
  for (let i = 0; i < S; i++) {
    const w = norm[OFFSET + i] ?? 0;
    result[i] = w > 1e-11 ? (out[OFFSET + i] ?? 0) / w : 0;
  }
  return result;
}

/**
 * One stem as a stereo waveform: the time branch plus the frequency branch brought back to time.
 * `freq` holds `[track][4][B][F]`, `time` holds `[track][2][S]`.
 */
export function stemOutput(
  freq: ArrayLike<number>,
  time: ArrayLike<number>,
  track: number,
): { left: Float32Array; right: Float32Array } {
  const plane = B * F;
  const base = track * 4 * plane;
  const left = ispec(freq, base, base + plane);
  const right = ispec(freq, base + 2 * plane, base + 3 * plane);
  const t = track * 2 * S;
  for (let i = 0; i < S; i++) {
    left[i] = (left[i] ?? 0) + (time[t + i] ?? 0);
    right[i] = (right[i] ?? 0) + (time[t + S + i] ?? 0);
  }
  return { left, right };
}

/** Segment starts across a song: 25 % overlap, the last one zero-filled. */
export function segmentStarts(length: number): number[] {
  const stride = Math.floor(S * (1 - DEMUCS.overlap));
  const starts: number[] = [];
  for (let start = 0; start < length; start += stride) starts.push(start);
  return starts.length > 0 ? starts : [0];
}

/** Crossfade weight inside a segment: linear ramps at both ends, flat in the middle. */
export function segmentWeight(i: number): number {
  const ramp = Math.floor(S * (1 - DEMUCS.overlap)) * 0.5;
  return Math.min(i / ramp, (S - i) / ramp, 1);
}
