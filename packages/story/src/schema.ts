import { valueSchema, type Value } from '@ie/core';
import { z } from 'zod';
import { voiceSchema, type Voice } from './audio.ts';
import { DIFFICULTIES, FIGHT_BARS, FIGHT_MODES, type Difficulty, type FightMode } from './fight.ts';
import { minigameBlockShape, type MinigameGame } from './minigame.ts';
import { logicSchemas, type RoutineBlock } from './logic.ts';
import { rpgBlockSchemas, type RpgBlock } from './rpg.ts';
import { sequenceBlockSchema, type SequenceBlock } from './sequence.ts';
import { exitsBlockSchema, type ExitsBlock } from './world.ts';

/** Stable, opaque IDs (see ADR 0007). Usable inside formulas, so no spaces or dots. */
export const idSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'IDs use letters, digits and _');

/**
 * A reference to something defined elsewhere (a variable, passage, character…). Empty means "not
 * chosen yet": an unfinished block is still a valid document, so it saves and loads, and analysis
 * reports it as an error, so it never plays.
 */
export const refSchema = z.union([idSchema, z.literal('')]);

/** A story line in both languages under one translation key. */
export interface LocalText {
  readonly id: string;
  readonly en?: string;
  readonly tr?: string;
}
export const localTextSchema = z.object({
  id: idSchema,
  en: z.string().optional(),
  tr: z.string().optional(),
});

/** A short label (variable, character or chapter name). Not a story line, so it has no line ID. */
export interface Label {
  readonly en?: string;
  readonly tr?: string;
}
export const labelSchema = z.object({ en: z.string().optional(), tr: z.string().optional() });

/** A formula string, or a plain number/boolean literal. */
export type Formula = string | number | boolean;
export const formulaSchema = z.union([z.string(), z.number(), z.boolean()]);

export const LAYOUTS = ['page', 'box', 'chat'] as const;
export type Layout = (typeof LAYOUTS)[number];

export const SCOPES = ['game', 'chapter', 'passage', 'temp', 'persistent'] as const;
export type Scope = (typeof SCOPES)[number];

export const VARIABLE_TYPES = ['number', 'text', 'bool', 'list', 'enum'] as const;
export type VariableType = (typeof VARIABLE_TYPES)[number];

export interface VariableDef {
  readonly id: string;
  readonly name: Label;
  readonly type: VariableType;
  /** Allowed values of a One-of (enum) variable. */
  readonly values?: readonly string[];
  readonly default?: Value;
  readonly scope?: Scope;
  readonly description?: string;
  readonly min?: number;
  readonly max?: number;
  /** Shown on the reader's character sheet. */
  readonly stat?: boolean;
}
export const variableSchema = z.object({
  id: idSchema,
  name: labelSchema,
  type: z.enum(VARIABLE_TYPES),
  values: z.array(z.string()).optional(),
  default: valueSchema.optional(),
  scope: z.enum(SCOPES).optional(),
  description: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  stat: z.boolean().optional(),
});

export interface CharacterDef {
  readonly id: string;
  readonly name: Label;
  /** Theme colour token for the name (`accent`, `fx-1`…). */
  readonly color?: string;
  /** Spelling the Turkish suffix engine should hear instead (Kemal → "Kemel"). */
  readonly suffixAs?: string;
  /** Dialogue blips while this character's lines type in. */
  readonly voice?: Voice;
}
export const characterSchema = z.object({
  id: idSchema,
  name: labelSchema,
  color: z.string().optional(),
  suffixAs: z.string().optional(),
  voice: voiceSchema.optional(),
});

interface BlockBase {
  readonly id: string;
}
export interface NarrationBlock extends BlockBase {
  readonly type: 'narration';
  readonly text: LocalText;
}
export interface DialogueBlock extends BlockBase {
  readonly type: 'dialogue';
  readonly speaker: string;
  readonly text: LocalText;
}
export interface ChoiceOption {
  readonly id: string;
  readonly text: LocalText;
  /** Hidden entirely while false ("hidden until revealed"). */
  readonly visibleIf?: Formula;
  /** Shown greyed out with a reason while false ("gated"). */
  readonly enabledIf?: Formula;
  readonly lockedText?: LocalText;
  readonly cost?: { readonly var: string; readonly amount: Formula };
  /** Disappears after it has been chosen once. */
  readonly once?: boolean;
  /** Shows the odds of the check this option starts with. */
  readonly showOdds?: boolean;
  /** Blocks run when chosen. Without a Jump, play rejoins after the choice. */
  readonly then: readonly Block[];
}
export interface ChoiceBlock extends BlockBase {
  readonly type: 'choice';
  readonly prompt?: LocalText;
  readonly timer?: { readonly seconds: number; readonly default?: string };
  readonly options: readonly ChoiceOption[];
}
export interface IfBlock extends BlockBase {
  readonly type: 'if';
  readonly branches: readonly {
    readonly id: string;
    readonly when: Formula;
    readonly then: readonly Block[];
  }[];
  readonly else?: readonly Block[];
}
export interface CheckBlock extends BlockBase {
  readonly type: 'check';
  readonly label?: LocalText;
  /** Dice notation: `1d20`, `2d6`. */
  readonly dice: string;
  readonly modifier?: Formula;
  /** Succeeds when roll + modifier reaches this. */
  readonly target: Formula;
  readonly success: readonly Block[];
  readonly fail: readonly Block[];
}
export interface InputBlock extends BlockBase {
  readonly type: 'input';
  readonly var: string;
  readonly prompt: LocalText;
  readonly maxLength?: number;
}
export interface PauseBlock extends BlockBase {
  readonly type: 'pause';
  /** Without seconds, waits for a tap. */
  readonly seconds?: number;
}
export interface NoteBlock extends BlockBase {
  readonly type: 'note';
  readonly text: string;
}
export const SET_OPS = ['set', 'add', 'subtract', 'toggle', 'append', 'remove'] as const;
export interface SetBlock extends BlockBase {
  readonly type: 'set';
  readonly var: string;
  readonly op?: (typeof SET_OPS)[number];
  readonly value?: Formula;
}
export interface JumpBlock extends BlockBase {
  readonly type: 'jump';
  readonly to: string;
}
export interface CallBlock extends BlockBase {
  readonly type: 'call';
  readonly to: string;
}
export interface ReturnBlock extends BlockBase {
  readonly type: 'return';
}
export interface RandomBlock extends BlockBase {
  readonly type: 'random';
  readonly branches: readonly {
    readonly id: string;
    readonly weight?: number;
    readonly then: readonly Block[];
  }[];
}
export interface EndBlock extends BlockBase {
  readonly type: 'end';
  readonly ending?: { readonly id: string; readonly title: LocalText };
}
/** A rhythm fight (ADR 0016). The story waits until it is won or lost. */
export interface FightBlock extends BlockBase {
  readonly type: 'fight';
  readonly enemy: string;
  /** The song to fight to; without one, the music already playing, else a procedural beat. */
  readonly track?: string;
  readonly mode?: FightMode;
  readonly difficulty?: Difficulty;
  readonly bars?: number;
  /** A number variable that receives the score (0–100). */
  readonly score?: string;
  /** A scene sequence whose notes are the whole fight, instead of a generated chart (ADR 0019). */
  readonly chart?: string;
  readonly win: readonly Block[];
  readonly lose: readonly Block[];
}
/** A minigame (ADR 0021). The story waits until it is won or lost. */
export interface MinigameBlock extends BlockBase {
  readonly type: 'minigame';
  readonly game: MinigameGame;
  readonly title?: Label;
  /** A number variable that receives the score (0–100). */
  readonly score?: string;
  /** Number variables that receive the template's result values, by value name. */
  readonly store?: Readonly<Record<string, string>>;
  readonly win: readonly Block[];
  readonly lose: readonly Block[];
}
export interface ActionBlock extends BlockBase {
  readonly type: 'action';
  /** A kernel action id, such as `audio.play`. */
  readonly action: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

export type Block =
  | NarrationBlock
  | DialogueBlock
  | ChoiceBlock
  | IfBlock
  | CheckBlock
  | InputBlock
  | PauseBlock
  | NoteBlock
  | SetBlock
  | JumpBlock
  | CallBlock
  | ReturnBlock
  | RandomBlock
  | EndBlock
  | FightBlock
  | MinigameBlock
  | SequenceBlock
  | RpgBlock
  | RoutineBlock
  | ExitsBlock
  | ActionBlock;
export type BlockType = Block['type'];

const blocks = (): z.ZodType<readonly Block[]> => z.array(blockSchema);
const logic = logicSchemas(blocks);

const optionSchema = z.object({
  id: idSchema,
  text: localTextSchema,
  visibleIf: formulaSchema.optional(),
  enabledIf: formulaSchema.optional(),
  lockedText: localTextSchema.optional(),
  cost: z.object({ var: refSchema, amount: formulaSchema }).optional(),
  once: z.boolean().optional(),
  showOdds: z.boolean().optional(),
  get then() {
    return blocks();
  },
});

export const blockSchema: z.ZodType<Block> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ id: idSchema, type: z.literal('narration'), text: localTextSchema }),
    z.object({
      id: idSchema,
      type: z.literal('dialogue'),
      speaker: refSchema,
      text: localTextSchema,
    }),
    z.object({
      id: idSchema,
      type: z.literal('choice'),
      prompt: localTextSchema.optional(),
      timer: z.object({ seconds: z.number().positive(), default: idSchema.optional() }).optional(),
      options: z.array(optionSchema).min(1),
    }),
    z.object({
      id: idSchema,
      type: z.literal('if'),
      branches: z.array(z.object({ id: idSchema, when: formulaSchema, then: blocks() })).min(1),
      else: blocks().optional(),
    }),
    z.object({
      id: idSchema,
      type: z.literal('check'),
      label: localTextSchema.optional(),
      dice: z.string().regex(/^\d{1,2}d\d{1,3}$/, 'Dice look like 1d20 or 2d6'),
      modifier: formulaSchema.optional(),
      target: formulaSchema,
      success: blocks(),
      fail: blocks(),
    }),
    z.object({
      id: idSchema,
      type: z.literal('input'),
      var: refSchema,
      prompt: localTextSchema,
      maxLength: z.number().int().positive().optional(),
    }),
    z.object({ id: idSchema, type: z.literal('pause'), seconds: z.number().positive().optional() }),
    z.object({ id: idSchema, type: z.literal('note'), text: z.string() }),
    z.object({
      id: idSchema,
      type: z.literal('set'),
      var: refSchema,
      op: z.enum(SET_OPS).optional(),
      value: formulaSchema.optional(),
    }),
    z.object({ id: idSchema, type: z.literal('jump'), to: refSchema }),
    z.object({ id: idSchema, type: z.literal('call'), to: refSchema }),
    z.object({ id: idSchema, type: z.literal('return') }),
    z.object({
      id: idSchema,
      type: z.literal('random'),
      branches: z
        .array(z.object({ id: idSchema, weight: z.number().positive().optional(), then: blocks() }))
        .min(1),
    }),
    z.object({
      id: idSchema,
      type: z.literal('end'),
      ending: z.object({ id: idSchema, title: localTextSchema }).optional(),
    }),
    z.object({
      id: idSchema,
      type: z.literal('fight'),
      enemy: refSchema,
      track: idSchema.optional(),
      mode: z.enum(FIGHT_MODES).optional(),
      difficulty: z.enum(DIFFICULTIES).optional(),
      bars: z.number().int().min(FIGHT_BARS.min).max(FIGHT_BARS.max).optional(),
      score: idSchema.optional(),
      chart: idSchema.optional(),
      win: blocks(),
      lose: blocks(),
    }),
    z.object({ id: idSchema, ...minigameBlockShape, win: blocks(), lose: blocks() }),
    sequenceBlockSchema,
    ...rpgBlockSchemas(blocks),
    logic.routineBlock,
    exitsBlockSchema,
    z.object({
      id: idSchema,
      type: z.literal('action'),
      action: z.string().regex(/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/),
      params: z.record(z.string(), z.unknown()).optional(),
    }),
  ]),
);

export interface Passage {
  readonly id: string;
  /** Author-facing name in the Flow view. */
  readonly name?: string;
  readonly layout?: Layout;
  /** Keep the previous passage's text on screen instead of starting a new page. */
  readonly keepPage?: boolean;
  readonly blocks: readonly Block[];
}
export const passageSchema = z.object({
  id: idSchema,
  name: z.string().optional(),
  layout: z.enum(LAYOUTS).optional(),
  keepPage: z.boolean().optional(),
  blocks: z.array(blockSchema),
});

export interface Chapter {
  readonly id: string;
  readonly title: Label;
  readonly layout?: Layout;
  readonly passages: readonly Passage[];
}
export const chapterSchema = z.object({
  id: idSchema,
  title: labelSchema,
  layout: z.enum(LAYOUTS).optional(),
  passages: z.array(passageSchema).min(1),
});

export type { StoryProject } from './project.ts';
