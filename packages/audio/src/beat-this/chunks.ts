import { BEAT_THIS } from './model.ts';

/*
 * The reference's window layout (beat_this `split_piece` and `aggregate_prediction` with
 * `keep_first`). The model sees 30-second windows; each keeps its middle, losing `border` frames
 * at both ends, and where windows overlap the earlier one wins. Reproducing it exactly matters:
 * a different layout moves beats at the seams.
 */

/** First frame of each window (the first is negative: it starts in padding). */
export function windowStarts(
  frames: number,
  chunk: number = BEAT_THIS.chunk,
  border: number = BEAT_THIS.border,
): number[] {
  const step = chunk - 2 * border;
  const starts: number[] = [];
  for (let s = -border; s < frames - border; s += step) starts.push(s);
  if (starts.length === 0) starts.push(-border);
  // The last window is moved back to end at the piece's end, rather than being mostly padding.
  if (frames > step) starts[starts.length - 1] = frames - (chunk - border);
  return starts;
}

/**
 * One window of `chunk` frames starting at `start`, zero outside the piece. The ONNX graph is
 * static at 1500 frames, so short pieces are padded too (log1p of silence is zero).
 */
export function windowAt(
  spect: Float32Array,
  frames: number,
  start: number,
  mels: number = BEAT_THIS.mels,
  chunk: number = BEAT_THIS.chunk,
): Float32Array {
  const out = new Float32Array(chunk * mels);
  const from = Math.max(0, start);
  const to = Math.min(frames, start + chunk);
  if (to > from) out.set(spect.subarray(from * mels, to * mels), (from - start) * mels);
  return out;
}

/** Joins per-window predictions into one curve over the piece (earlier windows win). */
export function aggregate(
  predictions: readonly Float32Array[],
  starts: readonly number[],
  frames: number,
  chunk: number = BEAT_THIS.chunk,
  border: number = BEAT_THIS.border,
): Float32Array {
  const out = new Float32Array(frames).fill(-1000);
  for (let w = predictions.length - 1; w >= 0; w--) {
    const prediction = predictions[w];
    const start = starts[w];
    if (!prediction || start === undefined) continue;
    for (let i = border; i < chunk - border; i++) {
      const t = start + i;
      if (t >= 0 && t < frames) out[t] = prediction[i] ?? -1000;
    }
  }
  return out;
}
