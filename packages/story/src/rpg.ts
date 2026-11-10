import { z } from 'zod';
import type { Block, Formula, Label } from './schema.ts';

/*
 * The RPG kit's data and blocks (ADR 0017): items, skills, quests, the hero's stats, and the
 * Item, Quest, Shop and Battle blocks. Schemas that hold block lists are factories, so this file
 * never imports schema.ts at run time (that would be an import cycle).
 */

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'IDs use letters, digits and _');
/** A reference; empty means not chosen yet (see refSchema in schema.ts). */
const ref = z.union([id, z.literal('')]);
const label = z.object({ en: z.string().optional(), tr: z.string().optional() });
const formula = z.union([z.string(), z.number(), z.boolean()]);

export const ITEM_KINDS = ['item', 'consumable', 'key'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/** Added to a number variable when the item is used (a potion: HP +20). */
export interface ItemEffect {
  readonly var: string;
  readonly amount: number;
}

export interface ItemDef {
  readonly id: string;
  readonly name: Label;
  readonly description?: Label;
  readonly kind?: ItemKind;
  /** What a shop asks for it, unless the shop sets its own price. */
  readonly price?: number;
  readonly effects?: readonly ItemEffect[];
}
export const itemSchema = z.object({
  id,
  name: label,
  description: label.optional(),
  kind: z.enum(ITEM_KINDS).optional(),
  price: z.number().int().min(0).max(1_000_000).optional(),
  effects: z
    .array(z.object({ var: ref, amount: z.number() }))
    .max(8)
    .optional(),
});

export interface SkillDef {
  readonly id: string;
  readonly name: Label;
  /** MP spent each use. */
  readonly cost?: number;
  /** Multiplies the hero's attack (harm) or is the amount healed, as a share of max HP (heal). */
  readonly power?: number;
  readonly heal?: boolean;
  /** Shown in battle only while this holds (a skill learned later). */
  readonly requires?: Formula;
}
export const skillSchema = z.object({
  id,
  name: label,
  cost: z.number().int().min(0).max(999).optional(),
  power: z.number().min(0.1).max(10).optional(),
  heal: z.boolean().optional(),
  requires: formula.optional(),
});

export interface QuestStep {
  readonly id: string;
  readonly text: Label;
}
export interface QuestDef {
  readonly id: string;
  readonly name: Label;
  readonly steps: readonly QuestStep[];
}
export const questSchema = z.object({
  id,
  name: label,
  steps: z.array(z.object({ id, text: label })).min(1),
});

/** Which number variables hold the hero's battle stats. */
export interface HeroDef {
  readonly hp?: string;
  readonly maxHp?: string;
  readonly attack?: string;
  readonly defense?: string;
  readonly mp?: string;
}
export const heroSchema = z.object({
  hp: id.optional(),
  maxHp: id.optional(),
  attack: id.optional(),
  defense: id.optional(),
  mp: id.optional(),
});

export const ITEM_OPS = ['give', 'take', 'use'] as const;
export type ItemOp = (typeof ITEM_OPS)[number];
export interface ItemBlock {
  readonly id: string;
  readonly type: 'item';
  readonly op: ItemOp;
  readonly item: string;
  /** How many; 1 when unset. */
  readonly count?: Formula;
}

export const QUEST_OPS = ['start', 'step', 'done', 'fail'] as const;
export type QuestOp = (typeof QUEST_OPS)[number];
export interface QuestBlock {
  readonly id: string;
  readonly type: 'quest';
  readonly op: QuestOp;
  readonly quest: string;
  /** The step to move to (`step`); the first step when a quest starts. */
  readonly step?: string;
}

export interface ShopStock {
  readonly item: string;
  readonly price?: number;
}
export interface ShopBlock {
  readonly id: string;
  readonly type: 'shop';
  /** The number variable spent and earned (gold). */
  readonly currency: string;
  readonly stock: readonly ShopStock[];
  /** The reader may sell what they carry for half its price. */
  readonly sells?: boolean;
}

export interface BattleBlock {
  readonly id: string;
  readonly type: 'battle';
  readonly enemy: string;
  /** The reader may try to run. */
  readonly flee?: boolean;
  readonly win: readonly Block[];
  readonly lose: readonly Block[];
  /** Where a successful escape goes; without it, play continues after the battle. */
  readonly fled?: readonly Block[];
}

export type RpgBlock = ItemBlock | QuestBlock | ShopBlock | BattleBlock;

/** Zod schemas for the RPG blocks; `blocks` is the (lazy) schema of a nested block list. */
export function rpgBlockSchemas(blocks: () => z.ZodType<readonly Block[]>) {
  return [
    z.object({
      id,
      type: z.literal('item'),
      op: z.enum(ITEM_OPS),
      item: ref,
      count: formula.optional(),
    }),
    z.object({
      id,
      type: z.literal('quest'),
      op: z.enum(QUEST_OPS),
      quest: ref,
      step: id.optional(),
    }),
    z.object({
      id,
      type: z.literal('shop'),
      currency: ref,
      stock: z
        .array(z.object({ item: ref, price: z.number().int().min(0).max(1_000_000).optional() }))
        .max(40),
      sells: z.boolean().optional(),
    }),
    z.object({
      id,
      type: z.literal('battle'),
      enemy: ref,
      flee: z.boolean().optional(),
      get win() {
        return blocks();
      },
      get lose() {
        return blocks();
      },
      get fled() {
        return blocks().optional();
      },
    }),
  ] as const;
}
