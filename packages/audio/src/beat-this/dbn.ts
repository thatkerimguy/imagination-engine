/**
 * madmom's DBNDownBeatTrackingProcessor, as Beat This! uses it for its `dbn` postprocessing:
 * 3 or 4 beats a bar, 55–215 BPM, transition lambda 100, observation lambda 16, at 50 frames a
 * second. A bar-position HMM decoded with Viterbi keeps one tempo through passages where the
 * network is unsure, where plain peak picking clicks at random.
 *
 * The state space is the reference's: for each beat of the bar and each tempo (an interval of
 * whole frames), one state per frame of that beat. Within a beat the path only moves on; tempo
 * may change at a beat boundary, with a probability falling off exponentially in the ratio.
 * Only boundary states need back-pointers, which keeps a long mix to a few megabytes.
 */
export interface DbnOptions {
  readonly fps?: number;
  readonly minBpm?: number;
  readonly maxBpm?: number;
  readonly beatsPerBar?: readonly number[];
  readonly transitionLambda?: number;
  readonly observationLambda?: number;
}

export interface DbnResult {
  /** Beat frames. */
  readonly beats: number[];
  /** Position of each beat in its bar, from 1. */
  readonly numbers: number[];
  readonly beatsPerBar: number;
}

const EPSILON = 1e-5;
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Beats and bar positions from Beat This! logits (one value per frame). */
export function trackDownbeats(
  beatLogits: Float32Array,
  downbeatLogits: Float32Array,
  options: DbnOptions = {},
): DbnResult {
  const T = Math.min(beatLogits.length, downbeatLogits.length);
  // Activations as beat_this prepares them: kept off 0 and 1, and beat without downbeat.
  const beat = new Float32Array(T);
  const down = new Float32Array(T);
  for (let t = 0; t < T; t++) {
    const b = sigmoid(beatLogits[t] ?? 0) * (1 - EPSILON) + EPSILON / 2;
    const d = sigmoid(downbeatLogits[t] ?? 0) * (1 - EPSILON) + EPSILON / 2;
    beat[t] = Math.max(b - d, EPSILON / 2);
    down[t] = d;
  }
  const fps = options.fps ?? 50;
  const minInterval = Math.round((60 * fps) / (options.maxBpm ?? 215));
  const maxInterval = Math.round((60 * fps) / (options.minBpm ?? 55));
  const intervals: number[] = [];
  for (let i = minInterval; i <= maxInterval; i++) intervals.push(i);

  let best: (DbnResult & { logProb: number }) | null = null;
  for (const beats of options.beatsPerBar ?? [3, 4]) {
    const result = decode(beat, down, intervals, beats, options);
    if (!best || result.logProb > best.logProb) best = result;
  }
  return best
    ? { beats: best.beats, numbers: best.numbers, beatsPerBar: best.beatsPerBar }
    : { beats: [], numbers: [], beatsPerBar: 4 };
}

function decode(
  beat: Float32Array,
  down: Float32Array,
  intervals: readonly number[],
  beatsPerBar: number,
  options: DbnOptions,
): DbnResult & { logProb: number } {
  const T = beat.length;
  const nI = intervals.length;
  const perBeat = intervals.reduce((a, b) => a + b, 0);
  const S = perBeat * beatsPerBar;
  const observationLambda = options.observationLambda ?? 16;
  const transitionLambda = options.transitionLambda ?? 100;

  // Layout: beat b, interval i occupies [first(b, i), first(b, i) + intervals[i]).
  const first = new Int32Array(beatsPerBar * nI);
  const boundary = new Int32Array(S).fill(-1);
  /** 0 = no beat, 1 = beat, 2 = downbeat: which observation density a state uses. */
  const pointer = new Uint8Array(S);
  const position = new Float32Array(S);
  let offset = 0;
  for (let b = 0; b < beatsPerBar; b++) {
    for (let i = 0; i < nI; i++) {
      const length = intervals[i] ?? 1;
      first[b * nI + i] = offset;
      boundary[offset] = b * nI + i;
      for (let k = 0; k < length; k++) {
        const frac = k / length;
        position[offset + k] = b + frac;
        if (frac < 1 / observationLambda) pointer[offset + k] = b === 0 ? 2 : 1;
      }
      offset += length;
    }
  }
  const last = new Int32Array(beatsPerBar * nI);
  for (let b = 0; b < beatsPerBar; b++)
    for (let i = 0; i < nI; i++)
      last[b * nI + i] = (first[b * nI + i] ?? 0) + (intervals[i] ?? 1) - 1;
  const lastOf = (b: number, i: number) => last[b * nI + i] ?? 0;

  // Tempo change at a beat boundary: exp(-λ |to/from - 1|), normalised per source tempo.
  const logTransition = new Float64Array(nI * nI);
  for (let i = 0; i < nI; i++) {
    let sum = 0;
    const row = new Float64Array(nI);
    for (let j = 0; j < nI; j++) {
      const p = Math.exp(
        -transitionLambda * Math.abs((intervals[j] ?? 1) / (intervals[i] ?? 1) - 1),
      );
      row[j] = p <= Number.EPSILON ? 0 : p;
      sum += row[j] ?? 0;
    }
    for (let j = 0; j < nI; j++) logTransition[i * nI + j] = Math.log((row[j] ?? 0) / sum);
  }

  const densities = new Float64Array(3);
  const observe = (t: number) => {
    const b = beat[t] ?? 0;
    const d = down[t] ?? 0;
    densities[0] = Math.log(Math.max(1e-12, 1 - b - d) / (observationLambda - 1));
    densities[1] = Math.log(b);
    densities[2] = Math.log(d);
  };

  let prev = new Float64Array(S);
  let cur = new Float64Array(S);
  const back = new Uint8Array(Math.max(1, T) * beatsPerBar * nI);
  if (T === 0) return { beats: [], numbers: [], beatsPerBar, logProb: -Infinity };
  observe(0);
  const initial = Math.log(1 / S);
  for (let s = 0; s < S; s++) prev[s] = initial + (densities[pointer[s] ?? 0] ?? 0);

  for (let t = 1; t < T; t++) {
    observe(t);
    const d0 = densities[0] ?? 0;
    const d1 = densities[1] ?? 0;
    const d2 = densities[2] ?? 0;
    for (let s = 1; s < S; s++) {
      const p = pointer[s];
      cur[s] = (prev[s - 1] ?? -Infinity) + (p === 0 ? d0 : p === 1 ? d1 : d2);
    }
    const row = t * beatsPerBar * nI;
    for (let b = 0; b < beatsPerBar; b++) {
      const from = ((b + beatsPerBar - 1) % beatsPerBar) * nI;
      for (let j = 0; j < nI; j++) {
        let bestScore = -Infinity;
        let bestI = 0;
        for (let i = 0; i < nI; i++) {
          const score =
            (prev[last[from + i] ?? 0] ?? -Infinity) + (logTransition[i * nI + j] ?? -Infinity);
          if (score > bestScore) {
            bestScore = score;
            bestI = i;
          }
        }
        const s = first[b * nI + j] ?? 0;
        back[row + b * nI + j] = bestI;
        cur[s] = bestScore + (densities[pointer[s] ?? 0] ?? 0);
      }
    }
    [prev, cur] = [cur, prev];
  }

  let state = 0;
  for (let s = 1; s < S; s++) if ((prev[s] ?? -Infinity) > (prev[state] ?? -Infinity)) state = s;
  const logProb = prev[state] ?? -Infinity;
  const path = new Int32Array(T);
  path[T - 1] = state;
  for (let t = T - 1; t > 0; t--) {
    const b = boundary[state] ?? -1;
    if (b >= 0) {
      const beatIndex = Math.floor(b / nI);
      const i = back[t * beatsPerBar * nI + b] ?? 0;
      state = lastOf((beatIndex + beatsPerBar - 1) % beatsPerBar, i);
    } else state -= 1;
    path[t - 1] = state;
  }

  // Each run of frames in a beat's range becomes one beat, at its strongest activation.
  const beats: number[] = [];
  const numbers: number[] = [];
  let runStart = -1;
  for (let t = 0; t <= T; t++) {
    const inRange = t < T && (pointer[path[t] ?? 0] ?? 0) >= 1;
    if (inRange && runStart < 0) runStart = t;
    if (!inRange && runStart >= 0) {
      let peak = runStart;
      let peakValue = -Infinity;
      for (let u = runStart; u < t; u++) {
        const v = Math.max(beat[u] ?? 0, down[u] ?? 0);
        if (v > peakValue) {
          peakValue = v;
          peak = u;
        }
      }
      beats.push(peak);
      numbers.push(Math.floor(position[path[peak] ?? 0] ?? 0) + 1);
      runStart = -1;
    }
  }
  return { beats, numbers, beatsPerBar, logProb };
}
