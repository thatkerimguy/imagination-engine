import {
  DICE_SIDES,
  MINIGAME_DEFAULTS,
  MINIGAME_LIMITS,
  type MinigameGame,
  type MinigameTemplate,
} from '@ie/story';
import type { MessageKey } from '../messages.ts';

/**
 * How each template's number parameters appear in the Studio: a slider over the schema's limits,
 * or a few fixed choices. The limits come from @ie/story, so a field can never save a value the
 * schema refuses.
 */
export interface ParamField {
  readonly key: string;
  readonly label: MessageKey;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** Fixed choices instead of a slider (dice sides, board size). */
  readonly choices?: readonly number[];
  /** Shown as a percentage of the bar (zone sizes). */
  readonly percent?: boolean;
  /** A checkbox can turn the parameter off entirely (the slider's time limit). */
  readonly optional?: boolean;
}

const range = (
  template: MinigameTemplate,
  key: string,
  label: MessageKey,
  step: number,
  extra: Partial<ParamField> = {},
): ParamField => {
  const limits = MINIGAME_LIMITS[template] as Record<string, readonly [number, number]>;
  const [min, max] = limits[key] ?? [0, 1];
  return { key, label, min, max, step, ...extra };
};

export const PARAM_FIELDS: Readonly<Record<MinigameTemplate, readonly ParamField[]>> = {
  lockpick: [
    range('lockpick', 'pins', 'mg.p.pins', 1),
    range('lockpick', 'tries', 'mg.p.tries', 1),
    range('lockpick', 'speed', 'mg.p.speed', 0.1),
    range('lockpick', 'zone', 'mg.p.zone', 0.01, { percent: true }),
  ],
  memory: [
    range('memory', 'pads', 'mg.p.pads', 1),
    range('memory', 'rounds', 'mg.p.rounds', 1),
    range('memory', 'pace', 'mg.p.pace', 0.1),
    range('memory', 'slips', 'mg.p.slips', 1),
  ],
  cipher: [range('cipher', 'seconds', 'mg.p.seconds', 5)],
  typing: [range('typing', 'seconds', 'mg.p.seconds', 5)],
  qte: [
    range('qte', 'prompts', 'mg.p.prompts', 1),
    range('qte', 'window', 'mg.p.window', 0.1),
    range('qte', 'slips', 'mg.p.slips', 1),
  ],
  dice: [
    range('dice', 'dice', 'mg.p.dice', 1),
    { key: 'sides', label: 'mg.p.sides', min: 4, max: 20, step: 1, choices: DICE_SIDES },
    range('dice', 'target', 'mg.p.target', 1),
    range('dice', 'rerolls', 'mg.p.rerolls', 1),
  ],
  slider: [
    { key: 'size', label: 'mg.p.size', min: 3, max: 4, step: 1, choices: [3, 4] },
    range('slider', 'shuffle', 'mg.p.shuffle', 2),
    range('slider', 'seconds', 'mg.p.seconds', 10, { optional: true }),
  ],
  tension: [
    range('tension', 'hold', 'mg.p.hold', 1),
    range('tension', 'limit', 'mg.p.limit', 1),
    range('tension', 'zone', 'mg.p.zone', 0.01, { percent: true }),
    range('tension', 'drift', 'mg.p.drift', 0.1),
  ],
  // A built game has its own editor (BuiltParts, BuiltRules).
  built: [],
};

/** A parameter's value in the block, else its default, else the middle of its range. */
export function paramValue(game: MinigameGame, field: ParamField): number | undefined {
  const own = (game as unknown as Record<string, unknown>)[field.key];
  if (typeof own === 'number') return own;
  const defaults = MINIGAME_DEFAULTS[game.template] as Record<string, number>;
  return defaults[field.key];
}

/** The block's game with one parameter set, or removed when `value` is undefined. */
export function withParam(
  game: MinigameGame,
  key: string,
  value: number | undefined,
): MinigameGame {
  const { [key]: _old, ...rest } = game as unknown as Record<string, unknown>;
  return (value === undefined ? rest : { ...rest, [key]: value }) as unknown as MinigameGame;
}

/** Rounds a slider's value onto its step, without float noise such as 0.30000000000000004. */
export function snap(value: number, field: ParamField): number {
  const stepped = Math.round((value - field.min) / field.step) * field.step + field.min;
  const decimals = Math.max(0, -Math.floor(Math.log10(field.step)));
  return Math.min(field.max, Math.max(field.min, Number(stepped.toFixed(decimals))));
}

/** A parameter for the screen: a percentage, or a number with as many decimals as its step. */
export function formatParam(value: number, field: ParamField, locale: string): string {
  if (field.percent) return `${Math.round(value * 100)}%`;
  const decimals = Math.max(0, -Math.floor(Math.log10(field.step)));
  return value.toLocaleString(locale, { maximumFractionDigits: decimals });
}
