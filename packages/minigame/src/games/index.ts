import type { Locale } from '@ie/i18n';
import type { MinigameGame, MinigameTemplate } from '@ie/story';
import { seededRandom, type MinigameDef, type MinigameSession } from '../types.ts';
import { built } from './built.ts';
import { cipher } from './cipher.ts';
import { dice } from './dice.ts';
import { lockpick } from './lockpick.ts';
import { memory } from './memory.ts';
import { qte } from './qte.ts';
import { slider } from './slider.ts';
import { tension } from './tension.ts';
import { typing } from './typing.ts';

/** Every template's rules, by template. A new template is one more entry here (ADR 0021). */
export const MINIGAMES = {
  lockpick,
  memory,
  cipher,
  typing,
  qte,
  dice,
  slider,
  tension,
  built,
} as const;

export interface SessionOptions {
  readonly seed: number;
  readonly locale: Locale;
  /** Eases the game for readers who asked for help: longer clocks, wider zones. */
  readonly relaxed?: boolean;
}

/** How much a relaxed game stretches its clocks and zones. */
export const RELAXED_EASE = 1.5;

/** Deals a game from a block's parameters. The same seed always deals the same game. */
export function startMinigame(game: MinigameGame, options: SessionOptions): MinigameSession {
  // The table pairs each template with its own parameters; the lookup can't prove that to TS.
  const def = MINIGAMES[game.template] as unknown as MinigameDef<MinigameGame, unknown>;
  const state = def.setup(game, {
    random: seededRandom(options.seed),
    locale: options.locale,
    ease: options.relaxed ? RELAXED_EASE : 1,
  });
  const template: MinigameTemplate = game.template;
  return {
    template,
    state,
    update: (dt) => def.update(state, dt),
    input: (input) => def.onInput(state, input),
    result: () => def.result(state),
    timeLeft: () => def.timeLeft?.(state) ?? null,
  };
}
