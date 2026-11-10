import type { Difficulty, MovePattern } from '@ie/story';

/** Notes a second each difficulty aims for (PLAN §6.4). */
export const DENSITY: Readonly<Record<Difficulty, readonly [number, number]>> = {
  easy: [1, 2.5],
  normal: [2, 4],
  hard: [3, 6],
};

/** Grid steps the reader's strikes can sit on, in beats: half notes down to sixteenths. */
export const SUBDIVISIONS = [2, 1, 0.5, 0.25] as const;

/** Share of grid steps a strike phrase fills; the rest are rests that let it breathe. */
export const FILL = 0.75;

/** Closest two notes may sit, in seconds, so fast songs never ask for the impossible. */
export const MIN_GAP: Readonly<Record<Difficulty, number>> = {
  easy: 0.3,
  normal: 0.18,
  hard: 0.11,
};

/**
 * The grid step for the reader's strikes: the one whose rate, at the usual fill, lands nearest the
 * middle of the difficulty's band without going over its top when any step fits.
 */
export function pickSubdivision(bpm: number, difficulty: Difficulty): number {
  const bps = bpm / 60;
  const [lo, hi] = DENSITY[difficulty];
  const mid = (lo + hi) / 2;
  const rate = (step: number) => (bps / step) * FILL;
  const fitting = SUBDIVISIONS.filter((s) => rate(s) <= hi);
  const pool = fitting.length > 0 ? fitting : [SUBDIVISIONS[0]];
  return pool.reduce((best, s) =>
    Math.abs(rate(s) - mid) < Math.abs(rate(best) - mid) ? s : best,
  );
}

/** Where a move's notes fall (beats from where it starts) and how many beats it takes. */
export const PATTERNS: Readonly<Record<MovePattern, { offsets: readonly number[]; span: number }>> =
  {
    jab: { offsets: [0], span: 1 },
    double: { offsets: [0, 0.5], span: 1 },
    flurry: { offsets: [0, 0.25, 0.5, 0.75], span: 1 },
    feint: { offsets: [0.5, 1.5], span: 2 },
    combo: { offsets: [0, 0.75, 1.5], span: 2 },
    sweep: { offsets: [0, 2], span: 4 },
  };

/** Drops notes closer than `minGap` seconds to the one kept before them. */
export function thin(offsets: readonly number[], secondsPerBeat: number, minGap: number): number[] {
  const kept: number[] = [];
  for (const offset of offsets) {
    const last = kept.at(-1);
    if (last === undefined || (offset - last) * secondsPerBeat >= minGap - 1e-9) kept.push(offset);
  }
  return kept;
}
