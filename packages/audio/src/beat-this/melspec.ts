import { FFT, hann } from '../dsp/fft.ts';
import { BEAT_THIS } from './model.ts';

/**
 * The log-mel spectrogram Beat This! was trained on, reproduced exactly: STFT with n_fft 1024
 * and hop 441 at 22050 Hz, a periodic Hann window, centred frames with reflect padding,
 * magnitudes divided by sqrt(n_fft), the reference mel filterbank, then log1p(1000 · x).
 * Returns `frames × mels` values, row-major.
 */
export function logMelSpectrogram(
  samples: Float32Array,
  filterbank: Float32Array,
): { frames: number; data: Float32Array } {
  const { nFft, hop, mels } = BEAT_THIS;
  const bins = nFft / 2 + 1;
  if (filterbank.length !== bins * mels) throw new Error('The mel filterbank has the wrong size.');
  const n = samples.length;
  const frames = 1 + Math.floor(n / hop);
  const pad = nFft / 2;
  const fft = new FFT(nFft);
  const window = hann(nFft);
  const frame = new Float32Array(nFft);
  const power = new Float32Array(bins);
  const magnitude = new Float32Array(bins);
  const data = new Float32Array(frames * mels);
  const scale = 1 / Math.sqrt(nFft);

  for (let t = 0; t < frames; t++) {
    const origin = t * hop - pad;
    for (let i = 0; i < nFft; i++) frame[i] = reflect(samples, origin + i) * (window[i] ?? 0);
    fft.power(frame, power);
    for (let k = 0; k < bins; k++) magnitude[k] = Math.sqrt(power[k] ?? 0) * scale;
    const row = t * mels;
    for (let k = 0; k < bins; k++) {
      const m = magnitude[k] ?? 0;
      if (m === 0) continue;
      const fb = k * mels;
      for (let j = 0; j < mels; j++)
        data[row + j] = (data[row + j] ?? 0) + m * (filterbank[fb + j] ?? 0);
    }
    for (let j = 0; j < mels; j++) data[row + j] = Math.log1p(1000 * (data[row + j] ?? 0));
  }
  return { frames, data };
}

/** torch's reflect padding: index -1 reads sample 1, index n reads sample n - 2. */
function reflect(samples: Float32Array, i: number): number {
  const n = samples.length;
  if (n < 2) return samples[0] ?? 0;
  const period = 2 * (n - 1);
  let j = ((i % period) + period) % period;
  if (j >= n) j = period - j;
  return samples[j] ?? 0;
}
