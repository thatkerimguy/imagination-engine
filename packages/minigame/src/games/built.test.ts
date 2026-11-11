import { defaultBuiltGame, minigameGameSchema, type BuiltGame } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { startMinigame } from './index.ts';

const play = (game: BuiltGame, seed = 1) => startMinigame(game, { seed, locale: 'en' });

describe('built minigames', () => {
  it('the starter game is valid and is won by pumping ten times', () => {
    const game = defaultBuiltGame();
    expect(minigameGameSchema.safeParse(game).success).toBe(true);
    const session = play(game);
    for (let i = 0; i < 9; i++) session.input({ kind: 'pick', index: 0 });
    expect(session.result()).toBeNull();
    session.input({ kind: 'pick', index: 0 });
    expect(session.result()).toEqual({ won: true, score: 100, values: { light: 10 } });
  });

  it('loses when the clock runs out, scoring the meter', () => {
    const session = play(defaultBuiltGame());
    for (let i = 0; i < 4; i++) session.input({ kind: 'pick', index: 0 });
    for (let t = 0; t < 16; t += 0.05) session.update(0.05);
    expect(session.result()).toEqual({ won: false, score: 40, values: { light: 4 } });
  });

  it('rolls dice, adds the roll, and runs second and start rules', () => {
    const game: BuiltGame = {
      template: 'built',
      meters: [
        { id: 'gold', label: { en: 'Gold' }, max: 50 },
        { id: 'heat', label: { en: 'Heat' }, start: 5, max: 5 },
      ],
      buttons: [],
      dice: { count: 2, sides: 6 },
      rules: [
        { id: 'a', on: 'start', then: [{ do: 'set', meter: 'gold', value: 3 }] },
        { id: 'b', on: 'roll', then: [{ do: 'addRoll', meter: 'gold' }] },
        { id: 'c', on: 'second', then: [{ do: 'subtract', meter: 'heat', value: 1 }] },
        { id: 'd', on: 'change', if: [{ of: 'heat', op: '=', value: 0 }], then: [{ do: 'lose' }] },
      ],
    };
    const session = play(game, 42);
    const state = session.state as { values: Map<string, number>; faces: number[] };
    expect(state.values.get('gold')).toBe(3);
    session.input({ kind: 'press' });
    const total = state.faces.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(2);
    expect(state.values.get('gold')).toBe(3 + total);
    // The same seed rolls the same.
    const again = play(game, 42);
    again.input({ kind: 'press' });
    expect((again.state as { faces: number[] }).faces).toEqual(state.faces);
    for (let t = 0; t < 5.01; t += 0.25) session.update(0.25);
    expect(session.result()?.won).toBe(false);
  });

  it('stops a chain of change rules that never settles', () => {
    const game: BuiltGame = {
      template: 'built',
      meters: [{ id: 'n', label: {}, max: 999 }],
      buttons: [{ id: 'go', label: {} }],
      rules: [
        { id: 'a', on: 'tap', button: 'go', then: [{ do: 'add', meter: 'n', value: 1 }] },
        { id: 'b', on: 'change', then: [{ do: 'add', meter: 'n', value: 1 }] },
      ],
    };
    const session = play(game);
    session.input({ kind: 'pick', index: 0 });
    const n = (session.state as { values: Map<string, number> }).values.get('n');
    expect(n).toBe(1 + 8);
  });

  it('ignores rules that point at a removed meter or button', () => {
    const game: BuiltGame = {
      ...defaultBuiltGame(),
      rules: [
        { id: 'x', on: 'tap', button: 'gone', then: [{ do: 'add', meter: 'gone', value: 1 }] },
      ],
    };
    const session = play(game);
    session.input({ kind: 'pick', index: 0 });
    session.input({ kind: 'pick', index: 7 });
    expect(session.result()).toBeNull();
  });
});
