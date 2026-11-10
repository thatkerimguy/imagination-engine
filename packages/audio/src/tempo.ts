import type { TrackAnalysis, TrackCalibration } from '@ie/story';

/**
 * Converts between playback time (seconds) and musical time (beats). Beat 0 is the first downbeat;
 * earlier beats are negative, and both ends extrapolate at the nearest tempo.
 */
export class TempoMap {
  private constructor(
    /** Beat times; at least two, with beat 0 at index `zero`. */
    private readonly times: readonly number[],
    private readonly zero: number,
    readonly beatsPerBar: number,
  ) {}

  /** A steady tempo with a downbeat at `offset` seconds. */
  static constant(bpm: number, offset = 0, beatsPerBar = 4): TempoMap {
    const spb = 60 / bpm;
    return new TempoMap([offset, offset + spb], 0, beatsPerBar);
  }

  static fromCalibration(c: TrackCalibration): TempoMap {
    return TempoMap.constant(c.bpm, c.offset, c.beatsPerBar);
  }

  /** A constant analysis becomes one straight line; a variable one follows every beat. */
  static fromAnalysis(a: TrackAnalysis): TempoMap {
    const zero = a.downbeats[0] ?? 0;
    if (a.beats.length < 2) return TempoMap.constant(a.bpm, a.beats[0] ?? 0, a.beatsPerBar);
    if (a.tempo === 'constant') {
      const spb = 60 / a.bpm;
      // The line through all beats, anchored where it best fits the first downbeat's index.
      const mean = a.beats.reduce((s, t, i) => s + t - spb * (i - zero), 0) / a.beats.length;
      return new TempoMap([mean, mean + spb], 0, a.beatsPerBar);
    }
    return new TempoMap(a.beats, zero, a.beatsPerBar);
  }

  get bpm(): number {
    const n = this.times.length;
    return (60 * (n - 1)) / ((this.times[n - 1] ?? 1) - (this.times[0] ?? 0));
  }

  /** Fractional beat at a playback time. */
  beatAt(time: number): number {
    const t = this.times;
    const n = t.length;
    const first = t[0] ?? 0;
    const last = t[n - 1] ?? 0;
    if (time <= first) return (time - first) / ((t[1] ?? 1) - first) - this.zero;
    if (time >= last) return n - 1 + (time - last) / (last - (t[n - 2] ?? 0)) - this.zero;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((t[mid] ?? 0) <= time) lo = mid;
      else hi = mid;
    }
    const a = t[lo] ?? 0;
    return lo + (time - a) / ((t[lo + 1] ?? a + 1) - a) - this.zero;
  }

  /** Playback time of a (fractional) beat. */
  timeAt(beat: number): number {
    const t = this.times;
    const n = t.length;
    const i = beat + this.zero;
    if (i <= 0) return (t[0] ?? 0) + i * ((t[1] ?? 1) - (t[0] ?? 0));
    if (i >= n - 1) return (t[n - 1] ?? 0) + (i - n + 1) * ((t[n - 1] ?? 0) - (t[n - 2] ?? 0));
    const lo = Math.floor(i);
    const a = t[lo] ?? 0;
    return a + (i - lo) * ((t[lo + 1] ?? a) - a);
  }

  /** Bar number and position within the bar (0 ≤ beat < beatsPerBar) at a playback time. */
  position(time: number): { bar: number; beat: number } {
    const b = this.beatAt(time);
    const bar = Math.floor(b / this.beatsPerBar);
    return { bar, beat: b - bar * this.beatsPerBar };
  }

  /** Playback time of the next beat that is a multiple of `grid` beats (1 = beat, 1/4 = 16th). */
  nextOnGrid(time: number, grid = 1): number {
    return this.timeAt(Math.ceil(this.beatAt(time) / grid - 1e-6) * grid);
  }
}
