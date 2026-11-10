import { z } from 'zod';

/*
 * The minigame builder (ADR 0025, PLAN §6.5): a minigame put together from parts and driven by
 * rules, with no code. Parts are meters (numbers shown as bars), buttons, dice and a clock. A rule
 * says when it runs, what must be true, and what it does.
 */

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'IDs use letters, digits and _');
const label = z.object({ en: z.string().max(40).optional(), tr: z.string().max(40).optional() });
type Label = z.infer<typeof label>;

/** When a rule runs. `change` runs after any rule changed a meter; `second` once a second. */
export const BUILT_EVENTS = ['start', 'tap', 'roll', 'change', 'second', 'timeout'] as const;
export type BuiltEvent = (typeof BUILT_EVENTS)[number];

export const BUILT_OPS = ['<', '<=', '=', '>=', '>'] as const;
export type BuiltOp = (typeof BUILT_OPS)[number];

/** What a rule does: change a meter by a number or by the last roll, or end the game. */
export const BUILT_ACTIONS = ['add', 'subtract', 'set', 'addRoll', 'win', 'lose'] as const;
export type BuiltActionKind = (typeof BUILT_ACTIONS)[number];

/** A condition may read a meter, the last roll's total, or the seconds gone by. */
export const BUILT_ROLL = 'roll';
export const BUILT_TIME = 'time';

export interface BuiltMeter {
  readonly id: string;
  readonly label: Label;
  readonly start?: number;
  readonly max: number;
}
export interface BuiltButton {
  readonly id: string;
  readonly label: Label;
}
export interface BuiltCondition {
  /** A meter id, `roll` or `time`. */
  readonly of: string;
  readonly op: BuiltOp;
  readonly value: number;
}
export interface BuiltAction {
  readonly do: BuiltActionKind;
  readonly meter?: string;
  readonly value?: number;
}
export interface BuiltRule {
  readonly id: string;
  readonly on: BuiltEvent;
  /** For `tap`: which button. */
  readonly button?: string;
  readonly if?: readonly BuiltCondition[];
  readonly then: readonly BuiltAction[];
}
export interface BuiltGame {
  readonly template: 'built';
  readonly meters: readonly BuiltMeter[];
  readonly buttons: readonly BuiltButton[];
  readonly dice?: { readonly count: number; readonly sides: number };
  /** A time limit; without one the game ends only by a rule. */
  readonly seconds?: number;
  /** What the clock running out means when no rule ends the game first. */
  readonly timeout?: 'win' | 'lose';
  /** The meter whose share of its maximum is the score (else won 100, lost 0). */
  readonly scoreMeter?: string;
  readonly rules: readonly BuiltRule[];
}

/** The limits the Studio's fields and the schema share. */
export const BUILT_LIMITS = {
  meters: [1, 4],
  buttons: [0, 6],
  rules: [1, 16],
  actions: [1, 4],
  conditions: [0, 3],
  max: [1, 999],
  value: [-999, 999],
  seconds: [5, 600],
  dice: [1, 4],
} as const;

const L = BUILT_LIMITS;
const whole = (r: readonly [number, number]) => z.number().int().min(r[0]).max(r[1]);

export const builtGameSchema = z.object({
  template: z.literal('built'),
  meters: z
    .array(z.object({ id, label, start: whole(L.value).optional(), max: whole(L.max) }))
    .min(L.meters[0])
    .max(L.meters[1]),
  buttons: z.array(z.object({ id, label })).max(L.buttons[1]),
  dice: z.object({ count: whole(L.dice), sides: z.literal([4, 6, 8, 10, 12, 20]) }).optional(),
  seconds: whole(L.seconds).optional(),
  timeout: z.enum(['win', 'lose']).optional(),
  scoreMeter: id.optional(),
  rules: z
    .array(
      z.object({
        id,
        on: z.enum(BUILT_EVENTS),
        button: id.optional(),
        if: z
          .array(z.object({ of: id, op: z.enum(BUILT_OPS), value: whole(L.value) }))
          .max(L.conditions[1])
          .optional(),
        then: z
          .array(
            z.object({
              do: z.enum(BUILT_ACTIONS),
              meter: id.optional(),
              value: whole(L.value).optional(),
            }),
          )
          .min(L.actions[0])
          .max(L.actions[1]),
      }),
    )
    .min(L.rules[0])
    .max(L.rules[1]),
}) satisfies z.ZodType<BuiltGame>;

/**
 * A new built game that already plays: tap Pump to fill the lantern before the clock runs out.
 * Fixed ids are fine: the game lives inside one block and ids only need to be unique within it.
 */
export function defaultBuiltGame(): BuiltGame {
  return {
    template: 'built',
    meters: [{ id: 'light', label: { en: 'Light', tr: 'Işık' }, start: 0, max: 10 }],
    buttons: [{ id: 'pump', label: { en: 'Pump', tr: 'Pompala' } }],
    seconds: 15,
    timeout: 'lose',
    scoreMeter: 'light',
    rules: [
      { id: 'r1', on: 'tap', button: 'pump', then: [{ do: 'add', meter: 'light', value: 1 }] },
      {
        id: 'r2',
        on: 'change',
        if: [{ of: 'light', op: '>=', value: 10 }],
        then: [{ do: 'win' }],
      },
    ],
  };
}

/** The numbers a built game reports: every meter's final value, by meter id. */
export const builtValues = (game: BuiltGame): readonly string[] => game.meters.map((m) => m.id);
