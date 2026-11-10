import { z } from 'zod';

/*
 * The RPG kit's part of the story state and log (ADR 0017): what the reader carries, how quests
 * stand, a battle in progress, rule bookkeeping, and the beats the RPG blocks leave on the page.
 */

export const QUEST_STATUSES = ['active', 'done', 'failed'] as const;
export type QuestStatus = (typeof QUEST_STATUSES)[number];

export interface QuestState {
  readonly status: QuestStatus;
  /** Index of the current step. */
  readonly step: number;
}

export interface BattleState {
  readonly blockId: string;
  readonly enemyHp: number;
  readonly round: number;
}

export const BATTLE_ACTS = ['attack', 'skill', 'item', 'flee'] as const;
export type BattleAct = (typeof BATTLE_ACTS)[number];

export type BattleOutcome = 'won' | 'lost' | 'fled';

export type RpgBeat =
  | {
      readonly kind: 'item';
      readonly blockId: string;
      readonly item: string;
      readonly op: 'give' | 'take' | 'use';
      readonly count: number;
    }
  | {
      readonly kind: 'quest';
      readonly blockId: string;
      readonly quest: string;
      readonly status: QuestStatus;
      readonly step: number;
    }
  | { readonly kind: 'shop'; readonly blockId: string }
  | {
      readonly kind: 'traded';
      readonly blockId: string;
      readonly item: string;
      readonly price: number;
      readonly sold: boolean;
    }
  | { readonly kind: 'battle'; readonly blockId: string }
  | {
      readonly kind: 'turn';
      readonly blockId: string;
      readonly actor: 'hero' | 'enemy';
      readonly act: BattleAct;
      /** The skill or item used. */
      readonly id?: string;
      /** Damage dealt, HP healed, or 0 for a miss or a failed escape. */
      readonly amount: number;
      readonly crit?: boolean;
    }
  | { readonly kind: 'battled'; readonly blockId: string; readonly outcome: BattleOutcome };

export const rpgBeatSchemas = [
  z.object({
    kind: z.literal('item'),
    blockId: z.string(),
    item: z.string(),
    op: z.enum(['give', 'take', 'use']),
    count: z.number(),
  }),
  z.object({
    kind: z.literal('quest'),
    blockId: z.string(),
    quest: z.string(),
    status: z.enum(QUEST_STATUSES),
    step: z.number().int(),
  }),
  z.object({ kind: z.literal('shop'), blockId: z.string() }),
  z.object({
    kind: z.literal('traded'),
    blockId: z.string(),
    item: z.string(),
    price: z.number(),
    sold: z.boolean(),
  }),
  z.object({ kind: z.literal('battle'), blockId: z.string() }),
  z.object({
    kind: z.literal('turn'),
    blockId: z.string(),
    actor: z.enum(['hero', 'enemy']),
    act: z.enum(BATTLE_ACTS),
    id: z.string().optional(),
    amount: z.number(),
    crit: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('battled'),
    blockId: z.string(),
    outcome: z.enum(['won', 'lost', 'fled']),
  }),
] as const;

/** The RPG fields of the story state; all optional, so older saves still load. */
export const rpgStateShape = {
  inv: z.record(z.string(), z.number().int().min(0)).optional(),
  quests: z
    .record(z.string(), z.object({ status: z.enum(QUEST_STATUSES), step: z.number().int() }))
    .optional(),
  battle: z
    .object({ blockId: z.string(), enemyHp: z.number(), round: z.number().int() })
    .optional(),
  events: z.array(z.string()).optional(),
  fired: z.record(z.string(), z.number().int()).optional(),
};
