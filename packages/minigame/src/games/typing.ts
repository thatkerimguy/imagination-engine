import { lower } from '@ie/i18n';
import { MINIGAME_DEFAULTS, pickLabel, type TypingGame } from '@ie/story';
import { defineMinigame, score } from '../types.ts';

export interface TypingState {
  readonly phrases: readonly string[];
  readonly locale: 'en' | 'tr';
  readonly limit: number;
  /** Letters in all phrases together, for the score of a game that ran out of time. */
  readonly total: number;
  index: number;
  /** What the reader has typed of the current phrase so far; always a correct beginning of it. */
  typed: string;
  /** Letters typed correctly in phrases already finished. */
  done: number;
  mistakes: number;
  timeLeft: number;
}

const D = MINIGAME_DEFAULTS.typing;

/**
 * Folds the differences a phone keyboard adds: case (Turkish-aware), curly quotes and runs of
 * spaces. The reader types the words, not the typography.
 */
export function typingFold(text: string, locale: 'en' | 'tr'): string {
  return lower(text.normalize('NFC'), locale)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ');
}

const over = (s: TypingState) => s.index >= s.phrases.length || s.timeLeft <= 0;

/** Type each phrase before the clock runs out; a wrong letter is refused and counted. */
export const typing = defineMinigame<TypingGame, TypingState>({
  id: 'typing',
  setup(game, ctx) {
    const phrases = game.phrases
      .map((phrase) => pickLabel(phrase, ctx.locale).normalize('NFC').replace(/\s+/g, ' ').trim())
      .filter((phrase) => phrase.length > 0);
    const limit = (game.seconds ?? D.seconds) * ctx.ease;
    return {
      phrases,
      locale: ctx.locale,
      limit,
      total: phrases.reduce((sum, phrase) => sum + phrase.length, 0),
      index: 0,
      typed: '',
      done: 0,
      mistakes: 0,
      timeLeft: limit,
    };
  },
  update(s, dt) {
    if (!over(s)) s.timeLeft = Math.max(0, s.timeLeft - dt);
  },
  onInput(s, input) {
    if (input.kind !== 'text' || over(s)) return;
    const phrase = s.phrases[s.index] ?? '';
    const want = typingFold(phrase, s.locale);
    const got = typingFold(input.text, s.locale);
    // Deleting is always allowed; anything else has to be a correct beginning of the phrase.
    if (got.length > typingFold(s.typed, s.locale).length && !want.startsWith(got)) {
      s.mistakes += 1;
      return;
    }
    if (!want.startsWith(got)) return;
    // Folding can change a letter's length, so count the phrase's own letters that were matched.
    let matched = 0;
    while (matched < phrase.length && typingFold(phrase.slice(0, matched), s.locale) !== got)
      matched += 1;
    s.typed = phrase.slice(0, matched);
    if (got.length < want.length) return;
    s.done += phrase.length;
    s.index += 1;
    s.typed = '';
  },
  result(s) {
    if (!over(s)) return null;
    const won = s.index >= s.phrases.length;
    const values = { mistakes: s.mistakes, seconds: Math.round(s.limit - s.timeLeft) };
    const progress = (s.done + s.typed.length) / Math.max(1, s.total);
    return {
      won,
      score: score(
        won ? Math.max(40, 60 + (40 * s.timeLeft) / s.limit - 3 * s.mistakes) : 55 * progress,
      ),
      values,
    };
  },
  timeLeft: (s) => s.timeLeft / s.limit,
});
