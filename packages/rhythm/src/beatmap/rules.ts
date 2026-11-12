import type { BeatmapDifficulty } from '@ie/story';

/*
 * How a beatmap's four dials turn into play (ADR 0033). The curves follow the genre's usual
 * shape, so imported charts feel the way their makers meant: circles shrink as `size` rises,
 * appear later as `approach` rises, and timing windows narrow as `accuracy` rises.
 */

export const MODS = ['easy', 'hard', 'hidden', 'slow', 'fast', 'noFail', 'auto'] as const;
export type Mod = (typeof MODS)[number];

/** Mods that can't be on together; turning one on turns the other off. */
export const EXCLUSIVE: Readonly<Partial<Record<Mod, Mod>>> = {
  easy: 'hard',
  hard: 'easy',
  slow: 'fast',
  fast: 'slow',
};

export type Judgement = 'perfect' | 'great' | 'good' | 'miss';
/** Accuracy weight of each judgement. */
export const JUDGEMENT_VALUE: Readonly<Record<Judgement, number>> = {
  perfect: 300,
  great: 100,
  good: 50,
  miss: 0,
};

export interface PlayRules {
  /** Circle radius in field widths. */
  readonly radius: number;
  /** How long before its time an object shows, in milliseconds of song time. */
  readonly preempt: number;
  readonly fadeIn: number;
  /** Half-widths of the timing windows, in milliseconds of song time. */
  readonly windows: { readonly perfect: number; readonly great: number; readonly good: number };
  readonly drain: number;
  /** Spins per second a spinner asks for. */
  readonly spinRate: number;
  /** Song speed: 0.75, 1 or 1.5. */
  readonly rate: number;
  readonly hidden: boolean;
  readonly noFail: boolean;
  readonly auto: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The dials after Easy (halved) or Hard (raised, capped at 10). */
export function adjustedDifficulty(
  d: BeatmapDifficulty,
  mods: readonly Mod[],
): BeatmapDifficulty {
  if (mods.includes('easy'))
    return {
      size: d.size / 2,
      approach: d.approach / 2,
      accuracy: d.accuracy / 2,
      drain: d.drain / 2,
    };
  if (mods.includes('hard'))
    return {
      size: clamp(d.size * 1.3, 0, 10),
      approach: clamp(d.approach * 1.4, 0, 10),
      accuracy: clamp(d.accuracy * 1.4, 0, 10),
      drain: clamp(d.drain * 1.4, 0, 10),
    };
  return d;
}

export function preemptFor(approach: number): number {
  return approach < 5 ? 1200 + (600 * (5 - approach)) / 5 : 1200 - (750 * (approach - 5)) / 5;
}

export function radiusFor(size: number): number {
  return (54.4 - 4.48 * size) / 512;
}

export function playRules(d: BeatmapDifficulty, mods: readonly Mod[] = []): PlayRules {
  const a = adjustedDifficulty(d, mods);
  const preempt = preemptFor(a.approach);
  return {
    radius: radiusFor(a.size),
    preempt,
    fadeIn: 400 * Math.min(1, preempt / 450),
    windows: {
      perfect: 80 - 6 * a.accuracy,
      great: 140 - 8 * a.accuracy,
      good: 200 - 10 * a.accuracy,
    },
    drain: a.drain,
    spinRate: 1.5 + 0.25 * a.accuracy,
    rate: mods.includes('slow') ? 0.75 : mods.includes('fast') ? 1.5 : 1,
    hidden: mods.includes('hidden'),
    noFail: mods.includes('noFail'),
    auto: mods.includes('auto'),
  };
}

/** The judgement for a tap `offset` ms from the object's time, or null outside every window. */
export function judgeOffset(offset: number, rules: PlayRules): Judgement | null {
  const off = Math.abs(offset);
  if (off <= rules.windows.perfect) return 'perfect';
  if (off <= rules.windows.great) return 'great';
  if (off <= rules.windows.good) return 'good';
  return null;
}

export type Rank = 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';

export function rankFor(accuracy: number, misses: number): Rank {
  if (accuracy >= 0.9999) return 'S+';
  if (accuracy >= 0.95 && misses === 0) return 'S';
  if (accuracy >= 0.9) return 'A';
  if (accuracy >= 0.8) return 'B';
  if (accuracy >= 0.7) return 'C';
  return 'D';
}

/** Health lost per second between notes, and per miss; health gained per judgement. */
export function healthChange(drain: number): {
  readonly perSecond: number;
  readonly miss: number;
  readonly gain: Readonly<Record<Judgement, number>>;
  readonly tick: number;
} {
  return {
    perSecond: 0.005 + drain * 0.004,
    miss: 0.06 + drain * 0.012,
    gain: { perfect: 0.035, great: 0.02, good: 0.005, miss: 0 },
    tick: 0.01,
  };
}
