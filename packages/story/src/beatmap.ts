import { z } from 'zod';
import type { Label } from './schema.ts';

/*
 * Beatmaps (ADR 0033): aim-and-tap rhythm charts played to a song, imported from .osu files or
 * made in the Studio. Times are milliseconds from the start of the audio file, because that is
 * what a song's timing is measured in and what imported charts carry. Positions sit on a field
 * one unit wide and FIELD_HEIGHT tall, so distances are the same in both directions. Like
 * world.ts, this never imports schema.ts at run time (an import cycle).
 */

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'IDs use letters, digits and _');
const ref = z.union([id, z.literal('')]);
const label = z.object({ en: z.string().optional(), tr: z.string().optional() });

/** The field is 4:3, measured in widths. */
export const FIELD_HEIGHT = 0.75;
export const BEATMAP_LIMITS = {
  objects: 6000,
  timing: 512,
  /** Points on one slider's path, the head not counted. */
  path: 256,
  /** The longest map: one hour. */
  ms: 3_600_000,
} as const;

export const SLIDER_CURVES = ['line', 'bezier', 'arc', 'smooth'] as const;
export type SliderCurve = (typeof SLIDER_CURVES)[number];

export interface FieldPoint {
  readonly x: number;
  readonly y: number;
}

interface HitObjectBase {
  readonly id: string;
  /** When it is hit, in milliseconds. */
  readonly t: number;
  /** Starts a new combo: the numbers count from 1 again. */
  readonly combo?: true;
}
export interface HitCircle extends HitObjectBase {
  readonly kind: 'circle';
  readonly x: number;
  readonly y: number;
}
export interface HitSlider extends HitObjectBase {
  readonly kind: 'slider';
  readonly x: number;
  readonly y: number;
  readonly curve: SliderCurve;
  /**
   * The path after the head. For `bezier`, a point given twice in a row ends one curve and starts
   * the next there (a sharp corner); `arc` uses the first two points only.
   */
  readonly path: readonly FieldPoint[];
  /** How far the ball travels along the path, in field widths; without it, the whole path. */
  readonly length?: number;
  /** Times the ball crosses the path: 1 goes there, 2 there and back, and so on. */
  readonly slides: number;
  /** When the ball arrives at the end of its last crossing, in milliseconds. */
  readonly end: number;
}
export interface HitSpinner extends HitObjectBase {
  readonly kind: 'spinner';
  readonly end: number;
}
export type HitObject = HitCircle | HitSlider | HitSpinner;

/** A tempo change: from `t` on, beats are `bpm` per minute and bars `meter` beats long. */
export interface TimingPoint {
  readonly t: number;
  readonly bpm: number;
  readonly meter?: number;
}

/**
 * Four dials from 0 to 10, as charts usually carry them. `size` shrinks the circles, `approach`
 * makes them appear later, `accuracy` narrows the timing windows, and `drain` makes health fall
 * faster and misses cost more.
 */
export interface BeatmapDifficulty {
  readonly size: number;
  readonly approach: number;
  readonly accuracy: number;
  readonly drain: number;
}

/** Where an imported chart came from, kept for credits. */
export interface BeatmapCredit {
  readonly title?: string;
  readonly artist?: string;
  /** Who made the chart. */
  readonly mapper?: string;
  /** The chart's own name for this difficulty. */
  readonly version?: string;
  readonly source?: string;
}

export interface BeatmapDef {
  readonly id: string;
  readonly name: Label;
  /** The song; without one, a click track plays the timing. */
  readonly track?: string;
  /** Silence before the song starts, in milliseconds. */
  readonly lead?: number;
  readonly difficulty: BeatmapDifficulty;
  /** Slider ticks per beat (0 for none). */
  readonly ticks?: number;
  readonly timing: readonly TimingPoint[];
  readonly objects: readonly HitObject[];
  readonly credit?: BeatmapCredit;
}

const coordinate = z.number().min(-0.5).max(1.5);
const time = z.number().min(-10_000).max(BEATMAP_LIMITS.ms);
const point = z.object({ x: coordinate, y: coordinate });
const dial = z.number().min(0).max(10);

export const hitObjectSchema = z.discriminatedUnion('kind', [
  z.object({
    id,
    kind: z.literal('circle'),
    t: time,
    combo: z.literal(true).optional(),
    x: coordinate,
    y: coordinate,
  }),
  z.object({
    id,
    kind: z.literal('slider'),
    t: time,
    combo: z.literal(true).optional(),
    x: coordinate,
    y: coordinate,
    curve: z.enum(SLIDER_CURVES),
    path: z.array(point).min(1).max(BEATMAP_LIMITS.path),
    length: z.number().positive().max(20).optional(),
    slides: z.number().int().min(1).max(100),
    end: time,
  }),
  z.object({
    id,
    kind: z.literal('spinner'),
    t: time,
    combo: z.literal(true).optional(),
    end: time,
  }),
]) as z.ZodType<HitObject>;

export const timingPointSchema = z.object({
  t: time,
  bpm: z.number().min(1).max(2000),
  meter: z.number().int().min(1).max(16).optional(),
});

export const beatmapDifficultySchema = z.object({
  size: dial,
  approach: dial,
  accuracy: dial,
  drain: dial,
});

export const beatmapSchema = z.object({
  id,
  name: label,
  track: ref.optional(),
  lead: z.number().min(0).max(10_000).optional(),
  difficulty: beatmapDifficultySchema,
  ticks: z.number().min(0).max(8).optional(),
  timing: z.array(timingPointSchema).min(1).max(BEATMAP_LIMITS.timing),
  objects: z.array(hitObjectSchema).max(BEATMAP_LIMITS.objects),
  credit: z
    .object({
      title: z.string().max(200).optional(),
      artist: z.string().max(200).optional(),
      mapper: z.string().max(200).optional(),
      version: z.string().max(200).optional(),
      source: z.string().max(200).optional(),
    })
    .optional(),
}) as z.ZodType<BeatmapDef>;

/** The end of an object in milliseconds: sliders and spinners last, circles don't. */
export function objectEnd(object: HitObject): number {
  return object.kind === 'circle' ? object.t : object.end;
}

/** What a finished beatmap reports back to the story. */
export interface RhythmResult {
  readonly won: boolean;
  /** Accuracy, 0–100. */
  readonly score: number;
}

export const rhythmResultSchema = z.object({
  won: z.boolean(),
  score: z.number().min(0).max(100),
});

/** The parts of a Rhythm block that aren't block lists (see RhythmBlock in schema.ts). */
export const rhythmBlockShape = {
  type: z.literal('rhythm'),
  beatmap: ref,
  /** A number variable that receives the accuracy (0–100). */
  score: id.optional(),
  /** Accuracy needed to win, 0–100; without it, finishing alive is enough. */
  pass: z.number().min(0).max(100).optional(),
};
