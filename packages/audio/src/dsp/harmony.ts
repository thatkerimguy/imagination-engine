/*
 * Beat-level harmony: chroma per beat, downbeats from where bass hits and chords change, the key
 * from the overall pitch profile, and section starts from where the music's character shifts.
 */

/** Mean of frame values between consecutive beats; each beat gets the span up to the next one. */
export function perBeat(values: Float32Array, beats: readonly number[], width = 1): Float32Array {
  const out = new Float32Array(beats.length * width);
  for (let i = 0; i < beats.length; i++) {
    const start = beats[i] ?? 0;
    const end = Math.max(start + 1, beats[i + 1] ?? start + 1);
    for (let t = start; t < end; t++)
      for (let c = 0; c < width; c++)
        out[i * width + c] =
          (out[i * width + c] ?? 0) + (values[t * width + c] ?? 0) / (end - start);
  }
  return out;
}

/**
 * The strongest value within `radius` frames of each beat: how hard the beat itself hits. Onset
 * curves peak a frame or two before the beat they belong to (the analysis window looks ahead),
 * so a window that starts at the beat would credit the accent to the beat before.
 */
export function peakPerBeat(
  values: Float32Array,
  beats: readonly number[],
  radius: number,
): Float32Array {
  return Float32Array.from(beats, (b) => {
    let peak = 0;
    for (let t = Math.max(0, b - radius); t <= Math.min(values.length - 1, b + radius); t++)
      peak = Math.max(peak, values[t] ?? 0);
    return peak;
  });
}

function zScore(x: Float32Array): Float32Array {
  const mean = x.reduce((s, v) => s + v, 0) / Math.max(1, x.length);
  const sd = Math.sqrt(x.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, x.length)) || 1;
  return x.map((v) => (v - mean) / sd);
}

function cosineDistance(
  a: Float32Array,
  ai: number,
  b: Float32Array,
  bi: number,
  n: number,
): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let c = 0; c < n; c++) {
    const x = a[ai + c] ?? 0;
    const y = b[bi + c] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na && nb ? 1 - dot / Math.sqrt(na * nb) : 0;
}

export interface Meter {
  readonly beatsPerBar: number;
  /** Index of the first downbeat (0 ≤ phase < beatsPerBar). */
  readonly phase: number;
}

/**
 * Tries 4/4 and 3/4 at every phase. A bar line is where the bass hits harder and the chord changes
 * more than on the other beats; 3/4 has to win clearly, since most music is in four.
 */
export function findMeter(lowOnsetPerBeat: Float32Array, chromaPerBeat: Float32Array): Meter {
  const n = lowOnsetPerBeat.length;
  const change = new Float32Array(n);
  for (let i = 1; i < n; i++)
    change[i] = cosineDistance(chromaPerBeat, (i - 1) * 12, chromaPerBeat, i * 12, 12);
  // Bass hits are z-scored; chord change stays raw (0 to 1), since z-scoring a song without
  // chord changes would blow its noise up to the same weight as a real change.
  const low = zScore(lowOnsetPerBeat);
  const accent = low.map((v, i) => v + 2 * (change[i] ?? 0));

  const score = (bar: number, phase: number) => {
    let on = 0;
    let onCount = 0;
    let off = 0;
    let offCount = 0;
    for (let i = 0; i < n; i++) {
      if ((i - phase) % bar === 0) {
        on += accent[i] ?? 0;
        onCount++;
      } else {
        off += accent[i] ?? 0;
        offCount++;
      }
    }
    return onCount && offCount ? on / onCount - off / offCount : 0;
  };

  let best: Meter & { score: number } = { beatsPerBar: 4, phase: 0, score: -Infinity };
  for (const bar of [4, 3])
    for (let phase = 0; phase < bar; phase++) {
      const s = score(bar, phase) * (bar === 3 ? 0.8 : 1);
      if (s > best.score) best = { beatsPerBar: bar, phase, score: s };
    }
  return { beatsPerBar: best.beatsPerBar, phase: best.phase };
}

/** Minimum correlation with a key profile; tonal music usually scores 0.6 to 0.9. */
const KEY_CONFIDENCE = 0.5;
/**
 * Minimum whitened pitch strength per frame (see chroma.ts) before a key is named at all. White
 * noise scores about 13 (neighbouring bins are not independent), clear music hundreds.
 */
const MIN_TONALITY = 30;

// Krumhansl–Kessler key profiles.
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlation(a: readonly number[], b: readonly number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = (a[i] ?? 0) - ma;
    const y = (b[i] ?? 0) - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** The key whose profile best matches the track's total pitch-class energy. */
export function estimateKey(chroma: Float32Array): {
  tonic: number;
  mode: 'major' | 'minor';
} | null {
  const total = new Array<number>(12).fill(0);
  for (let i = 0; i < chroma.length; i++) total[i % 12] = (total[i % 12] ?? 0) + (chroma[i] ?? 0);
  // How far notes stand above the noise, per frame: near zero for drums, speech and hiss.
  const frames = Math.max(1, chroma.length / 12);
  if (total.reduce((sum, v) => sum + v, 0) / frames < MIN_TONALITY) return null;
  let best = { tonic: 0, mode: 'major' as 'major' | 'minor', r: -Infinity };
  for (let tonic = 0; tonic < 12; tonic++) {
    const rotated = total.map((_, pc) => total[(pc + tonic) % 12] ?? 0);
    for (const [mode, profile] of [
      ['major', MAJOR],
      ['minor', MINOR],
    ] as const) {
      const r = correlation(rotated, profile);
      if (r > best.r) best = { tonic, mode, r };
    }
  }
  // Drums, speech and noise correlate weakly with every key; better no key than a made-up one.
  return best.r >= KEY_CONFIDENCE ? { tonic: best.tonic, mode: best.mode } : null;
}

/**
 * Section starts, as beat indices of downbeats. At each downbeat, compare the 8 bars before with
 * the 8 bars after (pitch profile and loudness); clear peaks in that difference start sections.
 */
export function findSections(
  chromaPerBeat: Float32Array,
  rmsPerBeat: Float32Array,
  downbeats: readonly number[],
  beatsPerBar: number,
): number[] {
  const span = 8 * beatsPerBar;
  const n = rmsPerBeat.length;
  const loud = zScore(rmsPerBeat);
  const feature = (from: number, to: number) => {
    const out = new Float32Array(13);
    const count = Math.max(1, to - from);
    for (let i = from; i < to; i++) {
      let norm = 0;
      for (let c = 0; c < 12; c++) norm += chromaPerBeat[i * 12 + c] ?? 0;
      for (let c = 0; c < 12; c++)
        out[c] = (out[c] ?? 0) + (chromaPerBeat[i * 12 + c] ?? 0) / (norm || 1) / count;
      out[12] = (out[12] ?? 0) + (loud[i] ?? 0) / count;
    }
    return out;
  };
  const novelty = downbeats.map((d) => {
    if (d < span / 2 || d + span / 2 > n) return 0;
    const a = feature(Math.max(0, d - span), d);
    const b = feature(d, Math.min(n, d + span));
    let dist = 0;
    for (let c = 0; c < 12; c++) dist += ((a[c] ?? 0) - (b[c] ?? 0)) ** 2;
    return Math.sqrt(dist) * 4 + Math.abs((a[12] ?? 0) - (b[12] ?? 0));
  });
  const mean = novelty.reduce((s, v) => s + v, 0) / Math.max(1, novelty.length);
  const sd = Math.sqrt(
    novelty.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, novelty.length),
  );
  const starts: number[] = [];
  const minGap = 4 * beatsPerBar;
  novelty.forEach((v, i) => {
    const isPeak = v > (novelty[i - 1] ?? 0) && v >= (novelty[i + 1] ?? 0);
    const d = downbeats[i] ?? 0;
    if (!isPeak || v < mean + sd) return;
    if (starts.length && d - (starts.at(-1) ?? 0) < minGap) return;
    starts.push(d);
  });
  return starts;
}
