import { createId } from '@ie/core';
import {
  BUILT_LIMITS,
  type BuiltAction,
  type BuiltButton,
  type BuiltGame,
  type BuiltMeter,
  type BuiltRule,
  type Label,
} from '@ie/story';

/*
 * Edits of a built minigame (ADR 0025). Removing a part also takes it out of every rule, so a game
 * never keeps a rule that points at nothing.
 */

export function addMeter(game: BuiltGame, label: Label): BuiltGame {
  if (game.meters.length >= BUILT_LIMITS.meters[1]) return game;
  return { ...game, meters: [...game.meters, { id: createId('m'), label, start: 0, max: 10 }] };
}

export function setMeter(game: BuiltGame, id: string, change: Partial<BuiltMeter>): BuiltGame {
  return {
    ...game,
    meters: game.meters.map((m) => {
      if (m.id !== id) return m;
      const next = { ...m, ...change };
      // The start can't be above the maximum.
      return next.start !== undefined && next.start > next.max
        ? { ...next, start: next.max }
        : next;
    }),
  };
}

const dropActions = (then: readonly BuiltAction[], meter: string) =>
  then.filter((a) => a.meter !== meter);

export function removeMeter(game: BuiltGame, id: string): BuiltGame {
  if (game.meters.length <= BUILT_LIMITS.meters[0]) return game;
  const rules = game.rules
    .map((r) => ({
      ...r,
      ...(r.if ? { if: r.if.filter((c) => c.of !== id) } : {}),
      then: dropActions(r.then, id),
    }))
    .filter((r) => r.then.length > 0);
  const { scoreMeter, ...rest } = game;
  const next: BuiltGame = {
    ...rest,
    ...(scoreMeter && scoreMeter !== id ? { scoreMeter } : {}),
    meters: game.meters.filter((m) => m.id !== id),
    rules,
  };
  // A game needs at least one rule; give it a fresh one that uses what is left.
  return rules.length > 0 ? next : { ...next, rules: [newRule(next)] };
}

export function addButton(game: BuiltGame, label: Label): BuiltGame {
  if (game.buttons.length >= BUILT_LIMITS.buttons[1]) return game;
  return { ...game, buttons: [...game.buttons, { id: createId('k'), label }] };
}

export function setButton(game: BuiltGame, id: string, label: Label): BuiltGame {
  return {
    ...game,
    buttons: game.buttons.map((b): BuiltButton => (b.id === id ? { ...b, label } : b)),
  };
}

export function removeButton(game: BuiltGame, id: string): BuiltGame {
  const rules = game.rules.filter((r) => !(r.on === 'tap' && r.button === id));
  const next: BuiltGame = { ...game, buttons: game.buttons.filter((b) => b.id !== id), rules };
  return rules.length > 0 ? next : { ...next, rules: [newRule(next)] };
}

/** A new rule that already does something: tapping the first button adds 1 to the first meter. */
export function newRule(game: BuiltGame): BuiltRule {
  const button = game.buttons[0];
  const meter = game.meters[0];
  return {
    id: createId('r'),
    ...(button ? { on: 'tap' as const, button: button.id } : { on: 'second' as const }),
    then: [meter ? { do: 'add', meter: meter.id, value: 1 } : { do: 'win' }],
  };
}

export function addRule(game: BuiltGame): BuiltGame {
  if (game.rules.length >= BUILT_LIMITS.rules[1]) return game;
  return { ...game, rules: [...game.rules, newRule(game)] };
}

export function setRule(
  game: BuiltGame,
  id: string,
  change: (rule: BuiltRule) => BuiltRule,
): BuiltGame {
  return { ...game, rules: game.rules.map((r) => (r.id === id ? change(r) : r)) };
}

export function removeRule(game: BuiltGame, id: string): BuiltGame {
  if (game.rules.length <= BUILT_LIMITS.rules[0]) return game;
  return { ...game, rules: game.rules.filter((r) => r.id !== id) };
}

/** An action of a new kind keeps its meter and number when the kind uses them. */
export function actionOfKind(
  action: BuiltAction,
  kind: BuiltAction['do'],
  game: BuiltGame,
): BuiltAction {
  if (kind === 'win' || kind === 'lose') return { do: kind };
  const meter = action.meter ?? game.meters[0]?.id;
  if (kind === 'addRoll') return { do: kind, ...(meter ? { meter } : {}) };
  return { do: kind, ...(meter ? { meter } : {}), value: action.value ?? 1 };
}
