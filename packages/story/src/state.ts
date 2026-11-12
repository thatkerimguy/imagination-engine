import { valueSchema, type Value } from '@ie/core';
import { z } from 'zod';
import type { Requirement } from './formula.ts';
import { LAYOUTS, type Layout } from './schema.ts';
import {
  rpgBeatSchemas,
  rpgStateShape,
  type BattleState,
  type QuestState,
  type RpgBeat,
} from './state-rpg.ts';

/** Why an option is greyed out. The reader turns this into words in the current language. */
/** Internal: the runtime edits its own copy of a state in place. */
export type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export type OptionLock =
  | { readonly kind: 'text' }
  | { readonly kind: 'requirement'; readonly requirement: Requirement }
  | { readonly kind: 'cost' }
  | { readonly kind: 'unknown' };

/** An exit of the current room as the reader sees it right now (ADR 0031). */
export interface ExitView {
  readonly id: string;
  readonly to: string;
  readonly enabled: boolean;
  readonly lock?: OptionLock;
}

export interface OptionView {
  readonly id: string;
  readonly enabled: boolean;
  /** Chosen before in this playthrough (revisit-aware choices). */
  readonly seen: boolean;
  readonly lock?: OptionLock;
  readonly odds?: number;
  readonly cost?: { readonly var: string; readonly amount: number };
}

/**
 * Everything the runtime shows, in order. Beats hold block IDs and the values they interpolated,
 * never rendered strings, so the backlog re-renders in the other language (ADR 0007).
 */
export type Beat =
  | {
      readonly kind: 'passage';
      readonly passageId: string;
      readonly layout: Layout;
      readonly keepPage: boolean;
    }
  | {
      readonly kind: 'line';
      readonly blockId: string;
      readonly values: Readonly<Record<string, Value>>;
    }
  | {
      readonly kind: 'choice';
      readonly blockId: string;
      readonly options: readonly OptionView[];
      readonly timer?: { readonly seconds: number; readonly defaultOption: string };
      readonly values: Readonly<Record<string, Value>>;
    }
  | {
      readonly kind: 'chosen';
      readonly blockId: string;
      readonly optionId: string;
      readonly values: Readonly<Record<string, Value>>;
    }
  | { readonly kind: 'input'; readonly blockId: string }
  | { readonly kind: 'answered'; readonly blockId: string; readonly value: string }
  | { readonly kind: 'pause'; readonly blockId: string; readonly seconds?: number }
  | {
      readonly kind: 'check';
      readonly blockId: string;
      readonly rolls: readonly number[];
      readonly modifier: number;
      readonly target: number;
      readonly success: boolean;
      readonly values: Readonly<Record<string, Value>>;
    }
  | { readonly kind: 'fight'; readonly blockId: string }
  | { readonly kind: 'sequence'; readonly blockId: string }
  | { readonly kind: 'minigame'; readonly blockId: string }
  | { readonly kind: 'rhythm'; readonly blockId: string }
  | {
      readonly kind: 'played';
      readonly blockId: string;
      readonly won: boolean;
      readonly score: number;
    }
  | {
      readonly kind: 'fought';
      readonly blockId: string;
      readonly won: boolean;
      readonly score: number;
    }
  | RpgBeat
  | {
      readonly kind: 'exits';
      readonly blockId: string;
      readonly room: string;
      readonly exits: readonly ExitView[];
    }
  | {
      readonly kind: 'went';
      readonly blockId: string;
      readonly room: string;
      /** The exit taken; absent when the map took the reader there (fast travel). */
      readonly exit?: string;
    }
  | { readonly kind: 'end'; readonly blockId: string | null; readonly endingId?: string };

/** One level of the execution stack: a block list and the next block to run in it. */
export interface Frame {
  readonly list: string;
  readonly index: number;
  /** ID of the block just before `index`, used to re-find the spot after the story is edited. */
  readonly at?: string;
  /** Marks a Call boundary: when the called passage ends, play returns below this frame. */
  readonly call?: boolean;
  /** A routine's inputs, readable and writable like variables while it runs. */
  readonly locals?: Readonly<Record<string, Value>>;
  /** The rule whose blocks this frame runs; it can't fire again until the frame is gone. */
  readonly rule?: string;
}

export interface StoryState {
  readonly v: 1;
  readonly frames: readonly Frame[];
  readonly vars: Readonly<Record<string, Value>>;
  readonly visits: Readonly<Record<string, number>>;
  readonly chosen: Readonly<Record<string, number>>;
  readonly rng: number;
  readonly chapter: string | null;
  readonly log: readonly Beat[];
  /** Index in `log` of the beat the reader must respond to, if any. */
  readonly waiting: number | null;
  readonly ended: boolean;
  /**
   * The last params of each `.set` action by scene key: what should be playing or showing now.
   * Hosts re-apply it after a load or a rewind. Missing in saves from before Phase 3.
   */
  readonly scene?: Readonly<Record<string, unknown>>;
  /** Item counts the reader carries (ADR 0017). */
  readonly inv?: Readonly<Record<string, number>>;
  readonly quests?: Readonly<Record<string, QuestState>>;
  /** The battle in progress, if any. */
  readonly battle?: BattleState;
  /** Rule events raised but not yet handled (`changed:gold`). */
  readonly events?: readonly string[];
  /** How often each rule has fired, for `once` rules. */
  readonly fired?: Readonly<Record<string, number>>;
  /** The room the reader is in (ADR 0031). */
  readonly room?: string;
  /** Rooms the reader has been in, in the order they first arrived. */
  readonly rooms?: readonly string[];
}

/** Scene key of a `.set` action: the action id, plus `:slot` when the params name a slot. */
export function sceneKey(action: string, params: unknown): string {
  const slot =
    params && typeof params === 'object' ? (params as Record<string, unknown>).slot : undefined;
  return typeof slot === 'string' ? `${action}:${slot}` : action;
}

/** The scene after an action runs: `.set` actions replace what their key was doing. */
export function rememberScene(
  scene: Readonly<Record<string, unknown>> | undefined,
  action: string,
  params: unknown,
): Readonly<Record<string, unknown>> {
  return action.endsWith('.set') ? { ...scene, [sceneKey(action, params)]: params } : (scene ?? {});
}

const values = z.record(z.string(), valueSchema);
const lock = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text') }),
  z.object({
    kind: z.literal('requirement'),
    requirement: z.object({
      var: z.string(),
      op: z.enum(['==', '!=', '<', '<=', '>', '>=']),
      value: valueSchema,
    }),
  }),
  z.object({ kind: z.literal('cost') }),
  z.object({ kind: z.literal('unknown') }),
]);

export const beatSchema: z.ZodType<Beat> = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('passage'),
    passageId: z.string(),
    layout: z.enum(LAYOUTS),
    keepPage: z.boolean(),
  }),
  z.object({ kind: z.literal('line'), blockId: z.string(), values }),
  z.object({
    kind: z.literal('choice'),
    blockId: z.string(),
    options: z.array(
      z.object({
        id: z.string(),
        enabled: z.boolean(),
        seen: z.boolean(),
        lock: lock.optional(),
        odds: z.number().optional(),
        cost: z.object({ var: z.string(), amount: z.number() }).optional(),
      }),
    ),
    timer: z.object({ seconds: z.number(), defaultOption: z.string() }).optional(),
    values,
  }),
  z.object({ kind: z.literal('chosen'), blockId: z.string(), optionId: z.string(), values }),
  z.object({ kind: z.literal('input'), blockId: z.string() }),
  z.object({ kind: z.literal('answered'), blockId: z.string(), value: z.string() }),
  z.object({ kind: z.literal('pause'), blockId: z.string(), seconds: z.number().optional() }),
  z.object({
    kind: z.literal('check'),
    blockId: z.string(),
    rolls: z.array(z.number()),
    modifier: z.number(),
    target: z.number(),
    success: z.boolean(),
    values,
  }),
  z.object({ kind: z.literal('fight'), blockId: z.string() }),
  z.object({ kind: z.literal('sequence'), blockId: z.string() }),
  z.object({ kind: z.literal('minigame'), blockId: z.string() }),
  z.object({ kind: z.literal('rhythm'), blockId: z.string() }),
  z.object({ kind: z.literal('played'), blockId: z.string(), won: z.boolean(), score: z.number() }),
  z.object({ kind: z.literal('fought'), blockId: z.string(), won: z.boolean(), score: z.number() }),
  ...rpgBeatSchemas,
  z.object({
    kind: z.literal('exits'),
    blockId: z.string(),
    room: z.string(),
    exits: z.array(
      z.object({ id: z.string(), to: z.string(), enabled: z.boolean(), lock: lock.optional() }),
    ),
  }),
  z.object({
    kind: z.literal('went'),
    blockId: z.string(),
    room: z.string(),
    exit: z.string().optional(),
  }),
  z.object({
    kind: z.literal('end'),
    blockId: z.string().nullable(),
    endingId: z.string().optional(),
  }),
]);

export const storyStateSchema: z.ZodType<StoryState> = z.object({
  v: z.literal(1),
  frames: z.array(
    z.object({
      list: z.string(),
      index: z.number().int().min(0),
      at: z.string().optional(),
      call: z.boolean().optional(),
      locals: values.optional(),
      rule: z.string().optional(),
    }),
  ),
  vars: values,
  visits: z.record(z.string(), z.number()),
  chosen: z.record(z.string(), z.number()),
  rng: z.number().int(),
  chapter: z.string().nullable(),
  log: z.array(beatSchema),
  waiting: z.number().int().nullable(),
  ended: z.boolean(),
  scene: z.record(z.string(), z.json()).optional(),
  ...rpgStateShape,
  room: z.string().optional(),
  rooms: z.array(z.string()).optional(),
});

/** Index of the beat that starts the page currently on screen. */
export function pageStart(log: readonly Beat[]): number {
  for (let i = log.length - 1; i >= 0; i--) {
    const beat = log[i];
    if (beat?.kind === 'passage' && !beat.keepPage) return i;
  }
  return 0;
}

/** A playthrough before its first passage; `seed` fixes its dice (a random seed when unset). */
export function emptyState(seed?: number): Mutable<StoryState> {
  return {
    v: 1,
    frames: [],
    vars: {},
    visits: {},
    chosen: {},
    rng: (seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0,
    chapter: null,
    log: [],
    waiting: null,
    ended: false,
  };
}
