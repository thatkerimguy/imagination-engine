import {
  defaultGame,
  MINIGAME_TEMPLATES,
  MINIGAME_VALUES,
  minigameResultSchema,
  type MinigameGame,
  type MinigameResult,
} from '@ie/story';
import { describe, expect, it } from 'vitest';
import { cipherLetters, type CipherState } from './games/cipher.ts';
import { diceTotal, type DiceState } from './games/dice.ts';
import { startMinigame } from './games/index.ts';
import type { LockpickState } from './games/lockpick.ts';
import type { MemoryState } from './games/memory.ts';
import type { QteState } from './games/qte.ts';
import { sliderSolved, type SliderState } from './games/slider.ts';
import type { TensionState } from './games/tension.ts';
import { typingFold, type TypingState } from './games/typing.ts';
import { seededRandom, type MinigameSession } from './types.ts';

const start = (game: MinigameGame, seed = 7, locale: 'en' | 'tr' = 'en', relaxed = false) =>
  startMinigame(game, { seed, locale, relaxed });

/** Runs time on in 60 fps frames until `until` holds or the game ends. */
function run(session: MinigameSession, seconds: number, until?: () => boolean): void {
  for (let t = 0; t < seconds && !session.result() && !until?.(); t += 1 / 60)
    session.update(1 / 60);
}

const done = (session: MinigameSession): MinigameResult => {
  const result = session.result();
  if (!result) throw new Error('The game is not over.');
  return result;
};

describe('every template', () => {
  it('deals the same game from the same seed, and another from another', () => {
    for (const template of MINIGAME_TEMPLATES) {
      const game = defaultGame(template);
      expect(start(game, 3).state).toEqual(start(game, 3).state);
    }
    expect(start({ template: 'qte' }, 1).state).not.toEqual(start({ template: 'qte' }, 2).state);
  });

  it('has no result until it is played, and never runs for ever when left alone', () => {
    for (const template of MINIGAME_TEMPLATES) {
      const session = start(defaultGame(template));
      expect(session.result()).toBeNull();
      run(session, 120);
      // Games without a clock wait for the reader; the others end on their own.
      const waits = ['lockpick', 'dice', 'slider', 'memory'].includes(template);
      expect(session.result() === null).toBe(waits);
    }
  });

  it('reports a valid result with only its own values', () => {
    const session = start({ template: 'qte', prompts: 3 });
    run(session, 60);
    const result = done(session);
    expect(minigameResultSchema.safeParse(result).success).toBe(true);
    expect(Object.keys(result.values ?? {})).toEqual([...MINIGAME_VALUES.qte]);
  });
});

describe('lockpick', () => {
  const play = (session: MinigameSession, hit: boolean) => {
    const s = session.state as LockpickState;
    const center = s.centers[s.opened] ?? 0;
    const inside = () => Math.abs(s.pos - center) <= s.zone / 4;
    run(session, 20, hit ? inside : () => !inside() && Math.abs(s.pos - center) > s.zone);
    session.input({ kind: 'press' });
  };

  it('opens when every pin is caught in its zone', () => {
    const session = start({ template: 'lockpick', pins: 3 });
    for (let i = 0; i < 3; i++) play(session, true);
    expect(done(session)).toEqual({ won: true, score: 100, values: { pins: 3, tries: 3 } });
  });

  it('breaks after the last try, and scores the pins opened', () => {
    const session = start({ template: 'lockpick', pins: 2, tries: 2 });
    play(session, true);
    play(session, false);
    expect(session.result()).toBeNull();
    play(session, false);
    expect(done(session)).toEqual({ won: false, score: 25, values: { pins: 1, tries: 0 } });
  });

  it('gives a wider zone and a slower pick when relaxed', () => {
    const normal = start({ template: 'lockpick' }).state as LockpickState;
    const eased = start({ template: 'lockpick' }, 7, 'en', true).state as LockpickState;
    expect(eased.zone).toBeGreaterThan(normal.zone);
    expect(eased.speed).toBeLessThan(normal.speed);
  });
});

describe('memory', () => {
  const repeat = (session: MinigameSession) => {
    const s = session.state as MemoryState;
    run(session, 30, () => s.phase === 'input');
    const count = s.round + 2;
    for (let i = 0; i < count; i++) session.input({ kind: 'pick', index: s.sequence[i] ?? 0 });
  };

  it('shows the pads in order, ignores taps while showing, and grows each round', () => {
    const session = start({ template: 'memory', rounds: 3 });
    const s = session.state as MemoryState;
    const seen: number[] = [];
    session.input({ kind: 'pick', index: s.sequence[0] ?? 0 });
    expect(s.entered).toBe(0);
    run(session, 30, () => {
      if (s.lit >= 0 && seen.at(-1) !== s.lit) seen.push(s.lit);
      return s.phase === 'input';
    });
    expect(seen).toEqual(s.sequence.slice(0, 2));
    repeat(session);
    expect(s.round).toBe(1);
    repeat(session);
    repeat(session);
    expect(done(session)).toEqual({ won: true, score: 100, values: { rounds: 3 } });
  });

  it('forgives the slips it was given, then ends', () => {
    const session = start({ template: 'memory', slips: 1 });
    const s = session.state as MemoryState;
    const wrong = () => {
      run(session, 30, () => s.phase === 'input');
      session.input({ kind: 'pick', index: ((s.sequence[0] ?? 0) + 1) % s.pads });
    };
    wrong();
    expect(session.result()).toBeNull();
    expect(s.phase).toBe('show');
    wrong();
    expect(done(session)).toMatchObject({ won: false, values: { rounds: 0 } });
  });
});

describe('cipher', () => {
  const solve = (session: MinigameSession) => {
    const s = session.state as CipherState;
    const used = new Set<number>();
    for (const letter of s.words[s.index] ?? []) {
      const tile = s.tiles.findIndex((t, i) => t === letter && !used.has(i));
      used.add(tile);
      session.input({ kind: 'pick', index: tile });
    }
  };

  it('uses Turkish capitals and keeps dotted and dotless letters apart', () => {
    expect(cipherLetters('ilk ışık', 'tr')).toEqual(['İ', 'L', 'K', 'I', 'Ş', 'I', 'K']);
    expect(cipherLetters('ilk', 'en')).toEqual(['I', 'L', 'K']);
    const s = start({ template: 'cipher', words: [{ en: 'spring', tr: 'çiğdem' }] }, 5, 'tr')
      .state as CipherState;
    expect(s.words[0]).toEqual(['Ç', 'İ', 'Ğ', 'D', 'E', 'M']);
    expect([...s.tiles].sort()).toEqual([...(s.words[0] ?? [])].sort());
    expect(s.tiles).not.toEqual(s.words[0]);
  });

  it('is won by spelling every word, and scores the time left', () => {
    const session = start({ template: 'cipher', words: [{ en: 'door' }, { en: 'key' }] });
    solve(session);
    expect(session.result()).toBeNull();
    solve(session);
    expect(done(session)).toEqual({ won: true, score: 100, values: { solved: 2, seconds: 0 } });
  });

  it('clears a wrong word, lets a letter be taken back, and is lost when time runs out', () => {
    const session = start({ template: 'cipher', words: [{ en: 'abc' }], seconds: 10 });
    const s = session.state as CipherState;
    const order = ['C', 'B', 'A'].map((letter) => s.tiles.indexOf(letter));
    session.input({ kind: 'pick', index: order[0] ?? 0 });
    session.input({ kind: 'back' });
    expect(s.picked).toEqual([]);
    for (const index of order) session.input({ kind: 'pick', index });
    expect(s.wrong).toBe(1);
    expect(s.picked).toEqual([]);
    run(session, 11);
    expect(done(session)).toEqual({ won: false, score: 0, values: { solved: 0, seconds: 10 } });
  });
});

describe('typing', () => {
  it('folds case the Turkish way and ignores curly quotes', () => {
    expect(typingFold('IŞIK', 'tr')).toBe('ışık');
    expect(typingFold('İstanbul’da', 'tr')).toBe("istanbul'da");
    expect(typingFold('IT', 'en')).toBe('it');
  });

  it('accepts a correct beginning, refuses and counts a wrong letter, and allows deleting', () => {
    const session = start({ template: 'typing', phrases: [{ en: 'Open up' }, { en: 'Now' }] });
    const s = session.state as TypingState;
    session.input({ kind: 'text', text: 'op' });
    expect(s.typed).toBe('Op');
    session.input({ kind: 'text', text: 'opx' });
    expect(s).toMatchObject({ typed: 'Op', mistakes: 1 });
    session.input({ kind: 'text', text: 'o' });
    expect(s.typed).toBe('O');
    session.input({ kind: 'text', text: 'OPEN UP' });
    expect(s).toMatchObject({ index: 1, typed: '' });
    session.input({ kind: 'text', text: 'now' });
    expect(done(session)).toEqual({ won: true, score: 97, values: { mistakes: 1, seconds: 0 } });
  });

  it('is lost when the clock runs out, scoring how far the reader got', () => {
    const session = start(
      { template: 'typing', phrases: [{ tr: 'Kapıyı aç' }], seconds: 5 },
      1,
      'tr',
    );
    session.input({ kind: 'text', text: 'KAPI' });
    expect((session.state as TypingState).typed).toBe('Kapı');
    run(session, 6);
    expect(done(session)).toMatchObject({ won: false, score: 24, values: { seconds: 5 } });
  });
});

describe('quick time', () => {
  it('counts right answers, and a wrong one or a timeout as a slip', () => {
    const session = start({ template: 'qte', prompts: 3, slips: 1 });
    const s = session.state as QteState;
    session.input({ kind: 'dir', dir: 'up' });
    expect(s.index).toBe(0);
    run(session, 5, () => s.phase === 'prompt');
    session.input({ kind: 'dir', dir: s.prompts[0] ?? 'up' });
    run(session, 5, () => s.phase === 'prompt');
    run(session, 5, () => s.index === 2);
    expect(s).toMatchObject({ hits: 1, slipsLeft: 0 });
    run(session, 5, () => s.phase === 'prompt');
    session.input({ kind: 'dir', dir: s.prompts[2] ?? 'up' });
    expect(done(session)).toEqual({ won: true, score: 67, values: { hits: 2 } });
  });

  it('is lost once the slips run out', () => {
    const session = start({ template: 'qte', prompts: 6, slips: 0 });
    run(session, 10);
    expect(done(session)).toEqual({ won: false, score: 0, values: { hits: 0 } });
  });
});

describe('dice', () => {
  const settle = (session: MinigameSession) => run(session, 1, () => false);

  it('rolls within the sides, and wins when the target is reached', () => {
    const session = start({ template: 'dice', dice: 3, sides: 6, target: 3, rerolls: 0 });
    const s = session.state as DiceState;
    session.input({ kind: 'pick', index: 0 });
    expect(s.held[0]).toBe(false);
    session.input({ kind: 'press' });
    expect(session.result()).toBeNull();
    settle(session);
    expect(s.faces.every((face) => face >= 1 && face <= 6)).toBe(true);
    expect(done(session)).toEqual({ won: true, score: 100, values: { total: diceTotal(s) } });
  });

  it('keeps held dice through a reroll and loses when no rolls are left', () => {
    const session = start({ template: 'dice', dice: 2, sides: 4, target: 100, rerolls: 1 }, 11);
    const s = session.state as DiceState;
    session.input({ kind: 'press' });
    settle(session);
    const kept = s.faces[0];
    session.input({ kind: 'pick', index: 0 });
    session.input({ kind: 'press' });
    settle(session);
    expect(s.faces[0]).toBe(kept);
    expect(s.faces[1]).toBe(s.rolls[1]?.[1]);
    expect(done(session)).toMatchObject({ won: false, values: { total: diceTotal(s) } });
  });

  it('does not spend a roll when every die is kept', () => {
    const session = start({ template: 'dice', dice: 1, target: 100, rerolls: 2 });
    const s = session.state as DiceState;
    session.input({ kind: 'press' });
    settle(session);
    session.input({ kind: 'pick', index: 0 });
    session.input({ kind: 'press' });
    expect(s.thrown).toBe(1);
  });
});

describe('slider', () => {
  it('is mixed, solvable, and only moves tiles next to the gap', () => {
    const session = start({ template: 'slider', size: 3, shuffle: 12 });
    const s = session.state as SliderState;
    expect(sliderSolved(s.tiles)).toBe(false);
    expect([...s.tiles].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const gap = s.tiles.indexOf(0);
    const far = s.tiles.findIndex(
      (_, i) =>
        Math.abs((i % 3) - (gap % 3)) + Math.abs(Math.floor(i / 3) - Math.floor(gap / 3)) > 1,
    );
    session.input({ kind: 'pick', index: far });
    expect(s.moves).toBe(0);
  });

  it('is won by sliding the tiles home, by tap or by arrow', () => {
    const session = start({ template: 'slider', size: 3, shuffle: 4 });
    const s = session.state as SliderState;
    // Put the board one push from solved: the last tile sits where the gap belongs.
    s.tiles.splice(0, 9, 1, 2, 3, 4, 5, 6, 7, 0, 8);
    // Nothing sits below the bottom row to push up.
    session.input({ kind: 'dir', dir: 'up' });
    expect(s.moves).toBe(0);
    session.input({ kind: 'dir', dir: 'left' });
    expect(done(session)).toEqual({ won: true, score: 100, values: { moves: 1, seconds: 0 } });
  });

  it('is lost when its clock runs out, and has no clock unless given one', () => {
    expect(start({ template: 'slider' }).timeLeft()).toBeNull();
    const session = start({ template: 'slider', seconds: 20 });
    run(session, 21);
    expect(done(session)).toMatchObject({ won: false, values: { moves: 0, seconds: 20 } });
  });
});

describe('tension', () => {
  it('is won by keeping the marker in the zone, and lost by letting go', () => {
    const session = start({ template: 'tension', hold: 3, limit: 20 });
    const s = session.state as TensionState;
    for (let t = 0; t < 20 && !session.result(); t += 1 / 60) {
      // A simple reader: pull when the marker is under the zone's centre, give when over it.
      session.input({ kind: s.pos < s.center ? 'press' : 'release' });
      session.update(1 / 60);
    }
    const won = done(session);
    expect(won.won).toBe(true);
    expect(won.score).toBeGreaterThan(60);

    const idle = start({ template: 'tension', hold: 3, limit: 6 });
    run(idle, 7);
    expect(done(idle)).toMatchObject({ won: false, values: { seconds: 6 } });
    expect((idle.state as TensionState).pos).toBe(0);
  });
});

describe('the seeded generator', () => {
  it('stays inside its range', () => {
    const random = seededRandom(42);
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value >= 0 && value < 1).toBe(true);
    }
  });
});
