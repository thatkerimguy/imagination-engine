import { upper } from '@ie/i18n';
import { MINIGAME_DEFAULTS, pickLabel, type CipherGame } from '@ie/story';
import { defineMinigame, score, shuffle } from '../types.ts';

export interface CipherState {
  /** Each word as upper-case letters in the reader's language. */
  readonly words: readonly (readonly string[])[];
  /** Every word's scramble, dealt at setup so it doesn't depend on how the reader plays. */
  readonly scrambles: readonly (readonly string[])[];
  readonly limit: number;
  index: number;
  /** The current word's letters, scrambled. */
  tiles: string[];
  /** Tile indexes in the order the reader picked them. */
  picked: number[];
  solved: number;
  timeLeft: number;
  /** Counts wrong answers, so the view can shake once for each. */
  wrong: number;
}

const D = MINIGAME_DEFAULTS.cipher;

/** A word as upper-case letters, without spaces; Turkish i becomes İ, not I. */
export function cipherLetters(word: string, locale: 'en' | 'tr'): string[] {
  return Array.from(upper(word.normalize('NFC'), locale).replace(/\s+/g, ''));
}

function scramble(word: readonly string[], random: () => number): string[] {
  for (let attempt = 0; attempt < 8; attempt++) {
    const tiles = shuffle([...word], random);
    if (tiles.some((letter, i) => letter !== word[i])) return tiles;
  }
  // A word of one repeated letter can't be scrambled; reversing is as good as anything.
  return [...word].reverse();
}

const over = (s: CipherState) => s.index >= s.words.length || s.timeLeft <= 0;

/** Tap scrambled letters in the right order to spell each word before the clock runs out. */
export const cipher = defineMinigame<CipherGame, CipherState>({
  id: 'cipher',
  setup(game, ctx) {
    const words = game.words
      .map((word) => cipherLetters(pickLabel(word, ctx.locale), ctx.locale))
      .filter((letters) => letters.length > 0);
    const limit = (game.seconds ?? D.seconds) * ctx.ease;
    const scrambles = words.map((word) => scramble(word, ctx.random));
    return {
      words,
      scrambles,
      limit,
      index: 0,
      tiles: [...(scrambles[0] ?? [])],
      picked: [],
      solved: 0,
      timeLeft: limit,
      wrong: 0,
    };
  },
  update(s, dt) {
    if (!over(s)) s.timeLeft = Math.max(0, s.timeLeft - dt);
  },
  onInput(s, input) {
    if (over(s)) return;
    if (input.kind === 'back') {
      s.picked.pop();
      return;
    }
    if (input.kind !== 'pick') return;
    const at = s.picked.indexOf(input.index);
    // Tapping a letter already placed takes it back out.
    if (at >= 0) {
      s.picked.splice(at, 1);
      return;
    }
    if (input.index < 0 || input.index >= s.tiles.length) return;
    s.picked.push(input.index);
    const word = s.words[s.index] ?? [];
    if (s.picked.length < word.length) return;
    const right = s.picked.every((tile, i) => s.tiles[tile] === word[i]);
    s.picked = [];
    if (!right) {
      s.wrong += 1;
      return;
    }
    s.solved += 1;
    s.index += 1;
    s.tiles = [...(s.scrambles[s.index] ?? [])];
  },
  result(s) {
    if (!over(s)) return null;
    const count = Math.max(1, s.words.length);
    const won = s.words.length > 0 ? s.index >= s.words.length : true;
    const values = { solved: s.solved, seconds: Math.round(s.limit - s.timeLeft) };
    return {
      won,
      score: score(won ? 60 + (40 * s.timeLeft) / s.limit : (55 * s.solved) / count),
      values,
    };
  },
  timeLeft: (s) => s.timeLeft / s.limit,
});
