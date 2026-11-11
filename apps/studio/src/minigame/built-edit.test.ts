import { defaultBuiltGame, minigameGameSchema } from '@ie/story';
import { describe, expect, it } from 'vitest';
import {
  actionOfKind,
  addButton,
  addMeter,
  addRule,
  removeButton,
  removeMeter,
  removeRule,
  setMeter,
} from './built-edit.ts';

const valid = (game: unknown) => minigameGameSchema.safeParse(game).success;

describe('built minigame edits', () => {
  it('adds parts and rules within the limits, staying valid', () => {
    let game = defaultBuiltGame();
    for (let i = 0; i < 6; i++) game = addMeter(game, { en: `M${i}` });
    expect(game.meters).toHaveLength(4);
    for (let i = 0; i < 9; i++) game = addButton(game, { en: `B${i}` });
    expect(game.buttons).toHaveLength(6);
    for (let i = 0; i < 20; i++) game = addRule(game);
    expect(game.rules).toHaveLength(16);
    expect(valid(game)).toBe(true);
  });

  it('removing a meter takes it out of rules and the score', () => {
    let game = addMeter(defaultBuiltGame(), { en: 'Other' });
    game = removeMeter(game, 'light');
    expect(game.meters.map((m) => m.id)).not.toContain('light');
    expect(game.scoreMeter).toBeUndefined();
    expect(JSON.stringify(game.rules)).not.toContain('light');
    expect(game.rules.length).toBeGreaterThan(0);
    expect(valid(game)).toBe(true);
    // The last meter stays.
    expect(removeMeter(game, game.meters[0]!.id).meters).toHaveLength(1);
  });

  it('removing a button drops the rules that wait for it', () => {
    const game = removeButton(defaultBuiltGame(), 'pump');
    expect(game.buttons).toEqual([]);
    expect(game.rules.some((r) => r.button === 'pump')).toBe(false);
    expect(valid(game)).toBe(true);
  });

  it('keeps the last rule and clamps a start above the maximum', () => {
    const one = { ...defaultBuiltGame(), rules: defaultBuiltGame().rules.slice(0, 1) };
    expect(removeRule(one, one.rules[0]!.id).rules).toHaveLength(1);
    const game = setMeter(defaultBuiltGame(), 'light', { start: 8, max: 5 });
    expect(game.meters[0]).toMatchObject({ start: 5, max: 5 });
  });

  it('changes an action’s kind, keeping what still applies', () => {
    const game = defaultBuiltGame();
    expect(actionOfKind({ do: 'add', meter: 'light', value: 3 }, 'set', game)).toEqual({
      do: 'set',
      meter: 'light',
      value: 3,
    });
    expect(actionOfKind({ do: 'add', meter: 'light', value: 3 }, 'win', game)).toEqual({
      do: 'win',
    });
    expect(actionOfKind({ do: 'win' }, 'addRoll', game)).toEqual({ do: 'addRoll', meter: 'light' });
  });
});
