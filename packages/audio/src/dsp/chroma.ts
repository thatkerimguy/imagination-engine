import { FFT, hann } from './fft.ts';

/** Notes the chroma listens to: E2 (82 Hz) to B6, bass fundamentals included. */
const LOW = 40;
const HIGH = 95;
/** Seconds per chroma frame: harmony changes far slower than onsets. */
const STEP = 0.04;

/** The note (as an index from LOW) of each FFT bin, or -1 outside the range. */
export function noteMap(sampleRate: number, fftSize: number): Int8Array {
  const map = new Int8Array(fftSize / 2 + 1).fill(-1);
  for (let k = 1; k < map.length; k++) {
    const midi = Math.round(69 + 12 * Math.log2((k * sampleRate) / fftSize / 440));
    if (midi >= LOW && midi <= HIGH) map[k] = midi - LOW;
  }
  return map;
}

/** Smallest power of two whose bins are finer than a semitone at E2 (about 4.9 Hz). */
function chromaFftSize(sampleRate: number): number {
  let size = 1024;
  while (sampleRate / size > 3) size *= 2;
  return size;
}

/**
 * 12 pitch-class strengths per onset frame (`chroma[t * 12 + pc]`), computed with a long window
 * (fine enough to tell bass notes apart) every 40 ms and held between.
 *
 * Each bin counts as its power over the average of about two semitones around it, minus what
 * noise would give (just over one), leaving out its own neighbourhood so a note never sets its
 * own floor. A plain sum of power
 * credits broadband sound (drums, hiss) to whichever pitch classes span more bins, and every busy
 * track then lands in the same key; whitened noise averages to zero whatever the bin count. The
 * result is signed on purpose, since clipping each frame at zero would bring that bias back.
 */
export function extractChroma(
  samples: Float32Array,
  sampleRate: number,
  hop: number,
  frames: number,
): Float32Array {
  const size = chromaFftSize(sampleRate);
  const fft = new FFT(size);
  const window = hann(size);
  const notes = noteMap(sampleRate, size);
  const noteLo = notes.indexOf(0);
  const noteHi = notes.lastIndexOf(HIGH - LOW) + 1;
  const frame = new Float32Array(size);
  const power = new Float32Array(size / 2 + 1);
  const prefix = new Float64Array(size / 2 + 2);
  const pcFrame = new Float32Array(12);
  const chroma = new Float32Array(frames * 12);
  const every = Math.max(1, Math.round((STEP * sampleRate) / hop));

  for (let t = 0; t < frames; t += every) {
    const origin = t * hop - size / 2;
    for (let i = 0; i < size; i++) frame[i] = (samples[origin + i] ?? 0) * (window[i] ?? 0);
    fft.power(frame, power);
    for (let k = 0; k < power.length; k++) prefix[k + 1] = (prefix[k] ?? 0) + (power[k] ?? 0);
    // A tenth of the average power in the note range bounds the floor, so a clean note in
    // silence doesn't produce an enormous ratio.
    const minFloor =
      (((prefix[noteHi] ?? 0) - (prefix[noteLo] ?? 0)) / Math.max(1, noteHi - noteLo)) * 0.1;
    pcFrame.fill(0);
    if (minFloor > 0) {
      for (let k = noteLo; k < noteHi; k++) {
        const note = notes[k] ?? -1;
        if (note < 0) continue;
        const w = Math.max(6, Math.round(k * 0.12));
        const lo = Math.max(0, k - w);
        const hi = Math.min(power.length, k + w + 1);
        const nearLo = Math.max(lo, k - 2);
        const nearHi = Math.min(hi, k + 3);
        const around =
          (prefix[hi] ?? 0) - (prefix[lo] ?? 0) - ((prefix[nearHi] ?? 0) - (prefix[nearLo] ?? 0));
        const m = Math.max(2, hi - lo - (nearHi - nearLo));
        const floor = Math.max(minFloor, around / m);
        // For noise, power over the mean of m other bins averages m / (m - 1), not 1.
        const pc = (note + LOW) % 12;
        pcFrame[pc] = (pcFrame[pc] ?? 0) + (power[k] ?? 0) / floor - m / (m - 1);
      }
    }
    for (let j = t; j < Math.min(frames, t + every); j++) chroma.set(pcFrame, j * 12);
  }
  return chroma;
}
