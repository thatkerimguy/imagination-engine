/*
 * Drum hits from a separated drum stem (ADR 0028). With the rest of the mix gone, a plain rise in
 * short-time energy is a hit, so a simple detector is enough and stays cheap.
 */

const HOP = 512;
/** Hits closer than this are one hit (a flam, a roll's first stroke). */
const MIN_GAP = 0.07;
/** Most a track keeps: about four hits a second over ten minutes. */
export const MAX_HITS = 2400;

/** Seconds of each drum hit in mono `samples` at `rate`, earliest first. */
export function drumHits(samples: Float32Array, rate: number): number[] {
  const frames = Math.floor(samples.length / HOP);
  if (frames < 3) return [];
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * HOP; i < (f + 1) * HOP; i++) sum += (samples[i] ?? 0) ** 2;
    energy[f] = Math.log1p(1000 * (sum / HOP));
  }
  const flux = new Float32Array(frames);
  for (let f = 1; f < frames; f++) flux[f] = Math.max(0, (energy[f] ?? 0) - (energy[f - 1] ?? 0));

  let mean = 0;
  for (const v of flux) mean += v;
  mean /= frames;
  let variance = 0;
  for (const v of flux) variance += (v - mean) ** 2;
  const threshold = mean + 1.5 * Math.sqrt(variance / frames);
  if (threshold <= 1e-6) return [];

  const hits: number[] = [];
  const gap = Math.max(1, Math.round((MIN_GAP * rate) / HOP));
  let last = -Infinity;
  for (let f = 1; f < frames - 1; f++) {
    const v = flux[f] ?? 0;
    if (v < threshold || v < (flux[f - 1] ?? 0) || v < (flux[f + 1] ?? 0)) continue;
    if (f - last < gap) continue;
    last = f;
    hits.push(Math.round(((f * HOP) / rate) * 1000) / 1000);
    if (hits.length >= MAX_HITS) break;
  }
  return hits;
}
