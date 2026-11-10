/*
 * Tempo and beat tracking on an onset envelope: autocorrelation with a tempo prior for the period,
 * then dynamic programming (Ellis 2007) for beats that both land on onsets and keep that period.
 */

export const MIN_BPM = 50;
export const MAX_BPM = 220;

/** Autocorrelation of `x` for lags 0..maxLag. */
function autocorrelation(x: Float32Array, maxLag: number): Float64Array {
  const out = new Float64Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = lag; i < x.length; i++) sum += (x[i] ?? 0) * (x[i - lag] ?? 0);
    out[lag] = sum;
  }
  return out;
}

/** Linear interpolation of an array at a fractional index. */
function at(a: Float64Array, i: number): number {
  const lo = Math.floor(i);
  const f = i - lo;
  return (a[lo] ?? 0) * (1 - f) + (a[lo + 1] ?? 0) * f;
}

/**
 * The beat period in frames. Each candidate lag scores its autocorrelation plus half that of its
 * double, weighted by a log-normal prior around 120 BPM, which settles most octave confusions the
 * way listeners do.
 */
export function estimatePeriod(onset: Float32Array, fps: number): number {
  const minLag = Math.floor((60 * fps) / MAX_BPM);
  const maxLag = Math.ceil((60 * fps) / MIN_BPM);
  const acf = autocorrelation(onset, Math.min(onset.length - 1, maxLag * 2 + 2));
  let best = (60 * fps) / 120;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * fps) / lag;
    const prior = Math.exp(-0.5 * Math.log2(bpm / 120) ** 2);
    const score = ((acf[lag] ?? 0) + 0.5 * at(acf, lag * 2)) * prior;
    if (score > bestScore) {
      bestScore = score;
      best = lag;
    }
  }
  // Parabolic interpolation around the peak for sub-frame precision.
  const lag = Math.round(best);
  const [a, b, c] = [acf[lag - 1] ?? 0, acf[lag] ?? 0, acf[lag + 1] ?? 0];
  const denom = a - 2 * b + c;
  const shift = denom === 0 ? 0 : (0.5 * (a - c)) / denom;
  return lag + Math.max(-0.5, Math.min(0.5, shift));
}

/** Beat frames that follow the onsets while keeping close to `period`. */
export function trackBeats(onset: Float32Array, period: number, tightness = 100): number[] {
  const n = onset.length;
  if (n === 0) return [];
  const score = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  const minBack = Math.max(1, Math.round(period / 2));
  const maxBack = Math.round(period * 2);
  for (let t = 0; t < n; t++) {
    let best = 0;
    let from = -1;
    for (let d = minBack; d <= maxBack && t - d >= 0; d++) {
      const penalty = tightness * Math.log(d / period) ** 2;
      const s = (score[t - d] ?? 0) - penalty;
      if (s > best || from < 0) {
        best = s;
        from = t - d;
      }
    }
    score[t] = (onset[t] ?? 0) + (from >= 0 ? Math.max(0, best) : 0);
    back[t] = from >= 0 && best > 0 ? from : -1;
  }
  // End on the best-scoring frame within the last period.
  let end = n - 1;
  for (let t = Math.max(0, n - Math.round(period)); t < n; t++)
    if ((score[t] ?? 0) > (score[end] ?? 0)) end = t;
  const beats: number[] = [];
  for (let t = end; t >= 0; t = back[t] ?? -1) beats.push(t);
  beats.reverse();
  return trimQuiet(beats, onset);
}

/** Drops beats at the very start and end that land in silence (fade-ins and fade-outs). */
function trimQuiet(beats: number[], onset: Float32Array): number[] {
  if (beats.length < 4) return beats;
  const strength = (f: number) => Math.max(onset[f - 1] ?? 0, onset[f] ?? 0, onset[f + 1] ?? 0);
  const levels = beats.map(strength);
  const rms = Math.sqrt(levels.reduce((s, v) => s + v * v, 0) / levels.length);
  const floor = 0.3 * rms;
  let first = 0;
  let last = beats.length - 1;
  while (first < last && (levels[first] ?? 0) < floor) first++;
  while (last > first && (levels[last] ?? 0) < floor) last--;
  return beats.slice(first, last + 1);
}

/** Moves each beat to the strongest onset within ±`radius` frames. */
export function refineBeats(beats: readonly number[], onset: Float32Array, radius = 2): number[] {
  return beats.map((b) => {
    let best = b;
    for (let f = b - radius; f <= b + radius; f++)
      if ((onset[f] ?? -1) > (onset[best] ?? -1)) best = f;
    return best;
  });
}

export interface TempoFit {
  readonly bpm: number;
  readonly kind: 'constant' | 'variable';
}

/**
 * Least-squares line through beat times. If every beat sits within 25 ms of it the tempo is
 * constant, and the line's slope is a steadier BPM than any single interval.
 */
export function fitTempo(times: readonly number[]): TempoFit {
  if (times.length < 2) return { bpm: 120, kind: 'constant' };
  const n = times.length;
  const meanI = (n - 1) / 2;
  const meanT = times.reduce((s, t) => s + t, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanI) * ((times[i] ?? 0) - meanT);
    den += (i - meanI) ** 2;
  }
  const slope = num / den;
  const origin = meanT - slope * meanI;
  let worst = 0;
  for (let i = 0; i < n; i++)
    worst = Math.max(worst, Math.abs((times[i] ?? 0) - (origin + slope * i)));
  return { bpm: 60 / slope, kind: worst <= 0.025 ? 'constant' : 'variable' };
}
