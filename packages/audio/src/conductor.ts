import type { TempoMap } from './tempo.ts';

/** Anything that plays: an audio buffer, a media element, Spotify, YouTube. */
export interface ClockSource {
  /** Current playback position in seconds, as the source reports it. */
  position(): number;
  readonly playing: boolean;
  /**
   * Exact sources (Web Audio, procedural music) read from the audio clock. Remote players report
   * coarse, jittery positions that the conductor smooths.
   */
  readonly exact: boolean;
}

export interface ConductorOptions {
  /** Seconds between when audio is scheduled and when it is heard (output + calibration). */
  readonly latency?: number;
  /** Wall clock in milliseconds. */
  readonly now?: () => number;
}

/** A reading further off than this is a seek or a stall: jump to it instead of easing. */
const SNAP_SECONDS = 0.25;
/** Fraction of the remaining drift corrected per reading. */
const EASE = 0.1;

/**
 * One musical clock over every source. Exact sources pass straight through. Remote ones are
 * extrapolated from the wall clock between reports and pulled gently towards each new report,
 * so beats stay smooth when the player's position jumps around by tens of milliseconds.
 */
export class Conductor {
  private latency: number;
  private readonly now: () => number;
  private anchorTime = 0;
  private anchorWall = 0;
  private lastReport = Number.NaN;
  private wasPlaying = false;

  constructor(
    private map: TempoMap,
    private readonly source: ClockSource,
    options: ConductorOptions = {},
  ) {
    this.latency = options.latency ?? 0;
    this.now = options.now ?? (() => performance.now());
  }

  setMap(map: TempoMap): void {
    this.map = map;
  }

  get tempo(): TempoMap {
    return this.map;
  }

  setLatency(seconds: number): void {
    this.latency = seconds;
  }

  /** Playback position as heard now, in seconds. */
  time(): number {
    return this.sourceTime() - this.latency;
  }

  /** Fractional beat heard now. */
  beat(): number {
    return this.map.beatAt(this.time());
  }

  position(): { bar: number; beat: number } {
    return this.map.position(this.time());
  }

  private sourceTime(): number {
    const reported = this.source.position();
    if (this.source.exact) return reported;
    const wall = this.now();
    const playing = this.source.playing;
    if (!playing) {
      this.wasPlaying = false;
      this.anchor(reported, wall);
      return reported;
    }
    const predicted = this.anchorTime + (wall - this.anchorWall) / 1000;
    if (!this.wasPlaying || Number.isNaN(this.lastReport)) {
      this.wasPlaying = true;
      this.anchor(reported, wall);
      return reported;
    }
    if (reported !== this.lastReport) {
      // A fresh report: snap on big jumps, otherwise ease towards it.
      const drift = reported - predicted;
      this.anchor(Math.abs(drift) > SNAP_SECONDS ? reported : predicted + drift * EASE, wall);
      this.lastReport = reported;
      return this.anchorTime;
    }
    return predicted;
  }

  private anchor(time: number, wall: number): void {
    this.anchorTime = time;
    this.anchorWall = wall;
    this.lastReport = time;
  }
}

/**
 * A beat grid from taps on a playing track: the median gap gives the tempo, and a least-squares
 * fit over every tap places the grid. The first tap is taken as a downbeat ("tap on the one").
 */
export function tapGrid(
  taps: readonly number[],
  beatsPerBar = 4,
): { bpm: number; offset: number; beatsPerBar: number } | null {
  if (taps.length < 4) return null;
  const gaps = taps
    .slice(1)
    .map((t, i) => t - (taps[i] ?? 0))
    .sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)] ?? 0;
  if (median <= 0) return null;
  const first = taps[0] ?? 0;
  const index = taps.map((t) => Math.round((t - first) / median));
  const n = taps.length;
  const mi = index.reduce((s, v) => s + v, 0) / n;
  const mt = taps.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let k = 0; k < n; k++) {
    num += ((index[k] ?? 0) - mi) * ((taps[k] ?? 0) - mt);
    den += ((index[k] ?? 0) - mi) ** 2;
  }
  const period = den ? num / den : median;
  const offset = mt - period * mi;
  return { bpm: Math.round((60 / period) * 100) / 100, offset, beatsPerBar };
}

/**
 * Input-plus-output latency from a tap-along test: how late taps land after the clicks they
 * answer, as a median so a few missed taps don't skew it.
 */
export function measureLatency(clicks: readonly number[], taps: readonly number[]): number | null {
  const offsets = taps
    .map((tap) => {
      let best = Number.POSITIVE_INFINITY;
      for (const c of clicks) if (Math.abs(tap - c) < Math.abs(best)) best = tap - c;
      return best;
    })
    .filter((d) => Math.abs(d) < 0.3)
    .sort((a, b) => a - b);
  if (offsets.length < 4) return null;
  return offsets[Math.floor(offsets.length / 2)] ?? null;
}
