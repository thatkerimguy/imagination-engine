import { z } from 'zod';
import type { Block, Formula, Label } from './schema.ts';

/*
 * Rules and routines (ADR 0017). Like rpg.ts, block-holding schemas are factories so this file
 * doesn't import schema.ts at run time.
 */

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'IDs use letters, digits and _');
/** A reference; empty means not chosen yet (see refSchema in schema.ts). */
const ref = z.union([id, z.literal('')]);
const label = z.object({ en: z.string().optional(), tr: z.string().optional() });
const formula = z.union([z.string(), z.number(), z.boolean()]);

/**
 * What makes a rule fire: a variable changed, a passage was entered, an item was gained or lost,
 * a quest changed. `target` names which one; an `entered` rule without one fires on every passage.
 */
export const RULE_EVENTS = ['changed', 'entered', 'gained', 'lost', 'quest'] as const;
export type RuleEvent = (typeof RULE_EVENTS)[number];

export interface RuleDef {
  readonly id: string;
  /** Author-facing name in the Logic workspace. */
  readonly name?: string;
  readonly on: RuleEvent;
  readonly target?: string;
  readonly if?: Formula;
  /** Fires only the first time in a playthrough. */
  readonly once?: boolean;
  readonly do: readonly Block[];
}

export const PARAM_TYPES = ['number', 'text', 'bool'] as const;
export type ParamType = (typeof PARAM_TYPES)[number];

/** An input of a routine. Its ID is used in formulas inside the routine, like a variable. */
export interface RoutineParam {
  readonly id: string;
  readonly name: Label;
  readonly type: ParamType;
}

export interface RoutineDef {
  readonly id: string;
  readonly name: string;
  readonly params?: readonly RoutineParam[];
  readonly blocks: readonly Block[];
}

/** Runs a routine, giving each input a value. */
export interface RoutineBlock {
  readonly id: string;
  readonly type: 'routine';
  readonly routine: string;
  readonly args?: Readonly<Record<string, Formula>>;
}

/** The event key a rule listens for (`changed:gold`), or every event of a kind (`entered:*`). */
export function eventKey(on: RuleEvent, target?: string): string {
  return `${on}:${target ?? '*'}`;
}

export function logicSchemas(blocks: () => z.ZodType<readonly Block[]>) {
  const rule = z.object({
    id,
    name: z.string().max(80).optional(),
    on: z.enum(RULE_EVENTS),
    target: id.optional(),
    if: formula.optional(),
    once: z.boolean().optional(),
    get do() {
      return blocks();
    },
  });
  const routine = z.object({
    id,
    name: z.string().max(80),
    params: z
      .array(z.object({ id, name: label, type: z.enum(PARAM_TYPES) }))
      .max(8)
      .optional(),
    get blocks() {
      return blocks();
    },
  });
  const routineBlock = z.object({
    id,
    type: z.literal('routine'),
    routine: ref,
    args: z.record(z.string(), formula).optional(),
  });
  return { rule, routine, routineBlock };
}
