import type { Locale } from '@ie/i18n';
import { z } from 'zod';
import { STAGE_COLORS, type StageColor } from './colors.ts';

/*
 * Rhythm fights (ADR 0016): enemies with movesets, and the settings a Fight block chooses.
 * This is data only; @ie/rhythm turns it into a chart and plays it.
 */

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'IDs use letters, digits and _');
const label = z.object({ en: z.string().optional(), tr: z.string().optional() });

export const FIGHT_MODES = ['call', 'free', 'mixed'] as const;
export type FightMode = (typeof FIGHT_MODES)[number];

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Rhythm shapes an enemy move can take; @ie/rhythm knows where each one's notes fall. */
export const MOVE_PATTERNS = ['jab', 'double', 'flurry', 'feint', 'combo', 'sweep'] as const;
export type MovePattern = (typeof MOVE_PATTERNS)[number];

/** How the reader answers a move: a tap parries it, a swipe dodges it. */
export const MOVE_ANSWERS = ['parry', 'dodge'] as const;
export type MoveAnswer = (typeof MOVE_ANSWERS)[number];

export interface EnemyMove {
  readonly id: string;
  readonly name: { readonly en?: string; readonly tr?: string };
  readonly pattern: MovePattern;
  readonly answer: MoveAnswer;
  /** Multiplies the enemy's attack for each note of this move that lands. */
  readonly power?: number;
}
export const enemyMoveSchema = z.object({
  id,
  name: label,
  pattern: z.enum(MOVE_PATTERNS),
  answer: z.enum(MOVE_ANSWERS),
  power: z.number().min(0.25).max(4).optional(),
});

export interface EnemyDef {
  readonly id: string;
  readonly name: { readonly en?: string; readonly tr?: string };
  /** How much the reader has to land to win; 100 is an ordinary foe. */
  readonly hp?: number;
  /** Damage to the reader (out of 100) for each attack note that gets through. */
  readonly attack?: number;
  /** Words that drift around the enemy on the stage, in both languages. */
  readonly presence?: readonly { readonly en?: string; readonly tr?: string }[];
  readonly color?: StageColor;
  readonly moves: readonly EnemyMove[];
}
export const enemySchema = z.object({
  id,
  name: label,
  hp: z.number().min(10).max(1000).optional(),
  attack: z.number().min(1).max(50).optional(),
  presence: z.array(label).max(12).optional(),
  color: z.enum(STAGE_COLORS).optional(),
  moves: z.array(enemyMoveSchema).min(1),
});

/** A label in the reader's language, else the other one, else `fallback`. */
export function pickLabel(
  label: { readonly en?: string; readonly tr?: string } | undefined,
  locale: Locale,
  fallback = '',
): string {
  return label?.[locale] || label?.en || label?.tr || fallback;
}

export const FIGHT_BARS = { min: 4, max: 64, default: 16 } as const;

/** What a finished fight reports back to the story. */
export interface FightResult {
  readonly won: boolean;
  /** Weighted hit rate, 0–100. */
  readonly score: number;
}
export const fightResultSchema = z.object({
  won: z.boolean(),
  score: z.number().min(0).max(100),
});
