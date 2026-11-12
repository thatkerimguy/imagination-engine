import type { TimingPoint } from '@ie/story';

/** The tempo in force at `t`: the last change at or before it, else the first. */
export function timingAt(timing: readonly TimingPoint[], t: number): TimingPoint {
  let found = timing[0] ?? { t: 0, bpm: 120 };
  for (const point of timing) {
    if (point.t > t) break;
    found = point;
  }
  return found;
}

/** Milliseconds per beat at `t`. */
export function beatLength(timing: readonly TimingPoint[], t: number): number {
  return 60_000 / timingAt(timing, t).bpm;
}

/** The nearest grid line at `divisor` lines per beat, kept inside the tempo section. */
export function snapTime(timing: readonly TimingPoint[], t: number, divisor: number): number {
  const point = timingAt(timing, t);
  const step = 60_000 / point.bpm / Math.max(1, divisor);
  const snapped = point.t + Math.round((t - point.t) / step) * step;
  const next = timing.find((p) => p.t > point.t);
  // A grid line past the next tempo change belongs to that change instead.
  if (next && snapped >= next.t) return next.t;
  return Math.round(snapped * 100) / 100;
}

export type GridStrength = 'bar' | 'beat' | 'sub';
export interface GridLine {
  readonly t: number;
  readonly strength: GridStrength;
}

/** Grid lines between `from` and `to` for a timeline, at most `limit` of them. */
export function gridLines(
  timing: readonly TimingPoint[],
  from: number,
  to: number,
  divisor: number,
  limit = 2000,
): GridLine[] {
  const out: GridLine[] = [];
  const sections = timing.length > 0 ? timing : [{ t: 0, bpm: 120 }];
  for (let i = 0; i < sections.length; i++) {
    const point = sections[i];
    if (!point) continue;
    const sectionEnd = sections[i + 1]?.t ?? Number.POSITIVE_INFINITY;
    if (sectionEnd < from || point.t > to) continue;
    const beat = 60_000 / point.bpm;
    const step = beat / Math.max(1, divisor);
    const meter = point.meter ?? 4;
    // Grid lines run backwards from the first tempo too, for notes before it.
    const startLine = Math.ceil((Math.max(from, i === 0 ? from : point.t) - point.t) / step);
    for (let n = startLine; ; n++) {
      const t = point.t + n * step;
      if (t > to || t >= sectionEnd) break;
      const beatIndex = n / divisor;
      const strength: GridStrength = Number.isInteger(beatIndex)
        ? beatIndex % meter === 0
          ? 'bar'
          : 'beat'
        : 'sub';
      out.push({ t, strength });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
