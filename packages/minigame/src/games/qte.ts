import { MINIGAME_DEFAULTS, type QteGame } from '@ie/story';
import { defineMinigame, DIRECTIONS, score, type Direction } from '../types.ts';

export interface QteState {
  readonly prompts: readonly Direction[];
  /** Seconds to answer each prompt. */
  readonly window: number;
  readonly slips: number;
  index: number;
  /** A short gap before each prompt, so two in a row never blur together. */
  phase: 'gap' | 'prompt' | 'done';
  /** Seconds left in the gap or the prompt. */
  clock: number;
  hits: number;
  slipsLeft: number;
  last: 'hit' | 'miss' | null;
}

const D = MINIGAME_DEFAULTS.qte;
const GAP = 0.45;

function next(s: QteState, hit: boolean): void {
  s.last = hit ? 'hit' : 'miss';
  if (hit) s.hits += 1;
  else s.slipsLeft -= 1;
  s.index += 1;
  if (s.slipsLeft < 0 || s.index >= s.prompts.length) s.phase = 'done';
  else {
    s.phase = 'gap';
    s.clock = GAP;
  }
}

/** A direction appears; answer it before its time runs out. */
export const qte = defineMinigame<QteGame, QteState>({
  id: 'qte',
  setup(game, ctx) {
    const count = game.prompts ?? D.prompts;
    const slips = game.slips ?? D.slips;
    return {
      prompts: Array.from(
        { length: count },
        () => DIRECTIONS[Math.floor(ctx.random() * DIRECTIONS.length)] ?? 'up',
      ),
      window: (game.window ?? D.window) * ctx.ease,
      slips,
      index: 0,
      phase: 'gap',
      clock: GAP * 2,
      hits: 0,
      slipsLeft: slips,
      last: null,
    };
  },
  update(s, dt) {
    if (s.phase === 'done') return;
    s.clock -= dt;
    if (s.clock > 0) return;
    if (s.phase === 'gap') {
      s.phase = 'prompt';
      s.clock = s.window;
    } else next(s, false);
  },
  onInput(s, input) {
    if (input.kind !== 'dir' || s.phase !== 'prompt') return;
    next(s, input.dir === s.prompts[s.index]);
  },
  result(s) {
    if (s.phase !== 'done') return null;
    const won = s.slipsLeft >= 0;
    const share = s.hits / Math.max(1, s.prompts.length);
    return { won, score: score(won ? 100 * share : 55 * share), values: { hits: s.hits } };
  },
  timeLeft: (s) => (s.phase === 'prompt' ? s.clock / s.window : null),
});
