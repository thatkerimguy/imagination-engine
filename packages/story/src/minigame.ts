import { z } from 'zod';
import {
  builtGameSchema,
  builtValues,
  defaultBuiltGame,
  type BuiltGame,
} from './minigame-built.ts';

/*
 * Minigames (ADR 0021): the templates a Minigame block can play and their parameters. This is
 * data only; @ie/minigame turns it into a game and reports the result.
 */

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'IDs use letters, digits and _');
const label = z.object({ en: z.string().max(80).optional(), tr: z.string().max(80).optional() });
type Words = readonly { readonly en?: string; readonly tr?: string }[];

export const MINIGAME_TEMPLATES = [
  'lockpick',
  'memory',
  'cipher',
  'typing',
  'qte',
  'dice',
  'slider',
  'tension',
  'built',
] as const;
export type MinigameTemplate = (typeof MINIGAME_TEMPLATES)[number];

export const DICE_SIDES = [4, 6, 8, 10, 12, 20] as const;

/** Stop a sweeping pick inside each pin's zone. */
export interface LockpickGame {
  readonly template: 'lockpick';
  readonly pins?: number;
  /** Sweeps across the lock each second. */
  readonly speed?: number;
  /** Width of a pin's zone, as a share of the lock. */
  readonly zone?: number;
  readonly tries?: number;
}
/** Repeat a growing sequence of pads. */
export interface MemoryGame {
  readonly template: 'memory';
  readonly pads?: number;
  readonly rounds?: number;
  /** Pads shown each second. */
  readonly pace?: number;
  /** Mistakes forgiven before the game is lost. */
  readonly slips?: number;
}
/** Put scrambled letters back in order. */
export interface CipherGame {
  readonly template: 'cipher';
  readonly words: Words;
  readonly seconds?: number;
}
/** Type phrases before the clock runs out. */
export interface TypingGame {
  readonly template: 'typing';
  readonly phrases: Words;
  readonly seconds?: number;
}
/** Answer direction prompts in time. */
export interface QteGame {
  readonly template: 'qte';
  readonly prompts?: number;
  /** Seconds to answer each prompt. */
  readonly window?: number;
  readonly slips?: number;
}
/** Roll to reach a target, keeping dice between rerolls. */
export interface DiceGame {
  readonly template: 'dice';
  readonly dice?: number;
  readonly sides?: (typeof DICE_SIDES)[number];
  readonly target?: number;
  readonly rerolls?: number;
}
/** Slide numbered tiles back into order. */
export interface SliderGame {
  readonly template: 'slider';
  readonly size?: number;
  /** How many moves the puzzle is mixed by. */
  readonly shuffle?: number;
  /** A time limit; without one the puzzle can't be lost. */
  readonly seconds?: number;
}
/** Hold and release to keep a marker inside a drifting zone. */
export interface TensionGame {
  readonly template: 'tension';
  /** Seconds the marker has to spend inside the zone. */
  readonly hold?: number;
  /** Seconds before the game is lost. */
  readonly limit?: number;
  readonly zone?: number;
  /** How fast the zone drifts. */
  readonly drift?: number;
}

export type MinigameGame =
  | LockpickGame
  | MemoryGame
  | CipherGame
  | TypingGame
  | QteGame
  | DiceGame
  | SliderGame
  | TensionGame
  | BuiltGame;

const int = (min: number, max: number) => z.number().int().min(min).max(max).optional();
const num = (min: number, max: number) => z.number().min(min).max(max).optional();
const words = z.array(label).min(1).max(8);

/** The limits the Studio's fields and the schema share. */
export const MINIGAME_LIMITS = {
  lockpick: { pins: [1, 8], speed: [0.3, 3], zone: [0.06, 0.4], tries: [1, 9] },
  memory: { pads: [3, 6], rounds: [2, 10], pace: [0.5, 3], slips: [0, 3] },
  cipher: { seconds: [10, 300] },
  typing: { seconds: [5, 300] },
  qte: { prompts: [3, 24], window: [0.4, 3], slips: [0, 5] },
  dice: { dice: [1, 6], target: [1, 120], rerolls: [0, 3] },
  slider: { size: [3, 4], shuffle: [4, 80], seconds: [20, 600] },
  tension: { hold: [2, 20], limit: [5, 90], zone: [0.15, 0.5], drift: [0.2, 2] },
  // A built game has its own limits (BUILT_LIMITS) and its own editor.
  built: {},
} as const satisfies Record<MinigameTemplate, Record<string, readonly [number, number]>>;

const L = MINIGAME_LIMITS;
const range = (r: readonly [number, number], whole = false) =>
  whole ? int(r[0], r[1]) : num(r[0], r[1]);

export const minigameGameSchema: z.ZodType<MinigameGame> = z.discriminatedUnion('template', [
  z.object({
    template: z.literal('lockpick'),
    pins: range(L.lockpick.pins, true),
    speed: range(L.lockpick.speed),
    zone: range(L.lockpick.zone),
    tries: range(L.lockpick.tries, true),
  }),
  z.object({
    template: z.literal('memory'),
    pads: range(L.memory.pads, true),
    rounds: range(L.memory.rounds, true),
    pace: range(L.memory.pace),
    slips: range(L.memory.slips, true),
  }),
  z.object({ template: z.literal('cipher'), words, seconds: range(L.cipher.seconds) }),
  z.object({ template: z.literal('typing'), phrases: words, seconds: range(L.typing.seconds) }),
  z.object({
    template: z.literal('qte'),
    prompts: range(L.qte.prompts, true),
    window: range(L.qte.window),
    slips: range(L.qte.slips, true),
  }),
  z.object({
    template: z.literal('dice'),
    dice: range(L.dice.dice, true),
    sides: z.literal([...DICE_SIDES]).optional(),
    target: range(L.dice.target, true),
    rerolls: range(L.dice.rerolls, true),
  }),
  z.object({
    template: z.literal('slider'),
    size: range(L.slider.size, true),
    shuffle: range(L.slider.shuffle, true),
    seconds: range(L.slider.seconds),
  }),
  z.object({
    template: z.literal('tension'),
    hold: range(L.tension.hold),
    limit: range(L.tension.limit),
    zone: range(L.tension.zone),
    drift: range(L.tension.drift),
  }),
  builtGameSchema,
]);

/** What a parameter is when the block leaves it out. A slider has no time limit by default. */
export const MINIGAME_DEFAULTS = {
  lockpick: { pins: 3, speed: 0.8, zone: 0.18, tries: 3 },
  memory: { pads: 4, rounds: 4, pace: 1.6, slips: 1 },
  cipher: { seconds: 60 },
  typing: { seconds: 30 },
  qte: { prompts: 6, window: 1.4, slips: 1 },
  dice: { dice: 2, sides: 6, target: 7, rerolls: 1 },
  slider: { size: 3, shuffle: 20 },
  tension: { hold: 6, limit: 25, zone: 0.3, drift: 1 },
  built: {},
} as const satisfies Record<MinigameTemplate, Record<string, number>>;

/** The numbers each template reports besides the score; a block can store them in variables. */
export const MINIGAME_VALUES = {
  lockpick: ['pins', 'tries'],
  memory: ['rounds'],
  cipher: ['solved', 'seconds'],
  typing: ['mistakes', 'seconds'],
  qte: ['hits'],
  dice: ['total'],
  slider: ['moves', 'seconds'],
  tension: ['seconds'],
  // A built game reports its meters instead: see minigameValues.
  built: [],
} as const satisfies Record<MinigameTemplate, readonly string[]>;

/** What a finished minigame reports back to the story. */
export interface MinigameResult {
  readonly won: boolean;
  /** 0–100. */
  readonly score: number;
  /** The template's named numbers (see MINIGAME_VALUES). */
  readonly values?: Readonly<Record<string, number>>;
}
export const minigameResultSchema = z.object({
  won: z.boolean(),
  score: z.number().min(0).max(100),
  values: z.record(z.string(), z.number()).optional(),
});

/** The parts of a Minigame block that aren't block lists (see MinigameBlock in schema.ts). */
export const minigameBlockShape = {
  type: z.literal('minigame'),
  game: minigameGameSchema,
  title: label.optional(),
  score: id.optional(),
  store: z.record(z.string(), id).optional(),
};

/** A starter game of a template, playable as it is. */
export function defaultGame(template: MinigameTemplate): MinigameGame {
  switch (template) {
    case 'cipher':
      return { template, words: [{ en: 'SECRET', tr: 'GİZEM' }] };
    case 'typing':
      return { template, phrases: [{ en: 'Open the door', tr: 'Kapıyı aç' }] };
    case 'built':
      return defaultBuiltGame();
    default:
      return { template };
  }
}

/** The named numbers a game reports, which a block can store in variables. */
export function minigameValues(game: MinigameGame): readonly string[] {
  return game.template === 'built' ? builtValues(game) : MINIGAME_VALUES[game.template];
}
