import { MINIGAME_DEFAULTS, type LockpickGame } from '@ie/story';
import { clamp, defineMinigame, score } from '../types.ts';

export interface LockpickState {
  readonly pins: number;
  readonly tries: number;
  /** Centre of each pin's zone, 0 to 1 across the lock. */
  readonly centers: readonly number[];
  readonly zone: number;
  /** Sweeps a second; rises a little with every pin opened. */
  speed: number;
  /** Where the pick is, 0 to 1, and which way it moves. */
  pos: number;
  dir: 1 | -1;
  opened: number;
  triesLeft: number;
  /** The last attempt, for the view's feedback. */
  last: 'hit' | 'miss' | null;
}

const D = MINIGAME_DEFAULTS.lockpick;

const over = (s: LockpickState) => s.opened >= s.pins || s.triesLeft <= 0;

/** Stop a sweeping pick inside each pin's zone; a miss costs a try. */
export const lockpick = defineMinigame<LockpickGame, LockpickState>({
  id: 'lockpick',
  setup(game, ctx) {
    const pins = game.pins ?? D.pins;
    const zone = clamp((game.zone ?? D.zone) * ctx.ease, 0.04, 0.6);
    const tries = game.tries ?? D.tries;
    return {
      pins,
      tries,
      zone,
      centers: Array.from({ length: pins }, () => zone / 2 + ctx.random() * (1 - zone)),
      speed: (game.speed ?? D.speed) / ctx.ease,
      pos: 0,
      dir: 1,
      opened: 0,
      triesLeft: tries,
      last: null,
    };
  },
  update(s, dt) {
    if (over(s)) return;
    s.pos += s.dir * s.speed * dt;
    // Bounce off the ends, keeping whatever distance was left over.
    while (s.pos > 1 || s.pos < 0) {
      s.pos = s.pos > 1 ? 2 - s.pos : -s.pos;
      s.dir = s.dir === 1 ? -1 : 1;
    }
  },
  onInput(s, input) {
    if (input.kind !== 'press' || over(s)) return;
    const center = s.centers[s.opened] ?? 0.5;
    if (Math.abs(s.pos - center) <= s.zone / 2) {
      s.opened += 1;
      s.speed *= 1.1;
      s.last = 'hit';
    } else {
      s.triesLeft -= 1;
      s.last = 'miss';
    }
  },
  result(s) {
    const values = { pins: s.opened, tries: s.triesLeft };
    if (s.opened >= s.pins)
      return { won: true, score: score(60 + (40 * s.triesLeft) / s.tries), values };
    if (s.triesLeft <= 0) return { won: false, score: score((50 * s.opened) / s.pins), values };
    return null;
  },
});
