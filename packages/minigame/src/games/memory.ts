import { MINIGAME_DEFAULTS, type MemoryGame } from '@ie/story';
import { defineMinigame, score } from '../types.ts';

export interface MemoryState {
  readonly pads: number;
  readonly rounds: number;
  /** The whole sequence; round r shows its first r + 2 pads. */
  readonly sequence: readonly number[];
  /** Seconds each pad is shown for. */
  readonly step: number;
  readonly slips: number;
  round: number;
  phase: 'show' | 'input' | 'done';
  /** Seconds into the current showing. */
  clock: number;
  /** The pad lit right now, or -1. */
  lit: number;
  /** How many pads of this round the reader has repeated. */
  entered: number;
  slipsLeft: number;
  last: 'hit' | 'miss' | null;
}

const D = MINIGAME_DEFAULTS.memory;
/** A breath before a round's first pad, in steps. */
const LEAD = 0.6;

const length = (s: MemoryState) => s.round + 2;

function show(s: MemoryState): void {
  s.phase = 'show';
  s.clock = 0;
  s.entered = 0;
  s.lit = -1;
}

/** Watch a sequence of pads light up, then repeat it; it grows by one each round. */
export const memory = defineMinigame<MemoryGame, MemoryState>({
  id: 'memory',
  setup(game, ctx) {
    const pads = game.pads ?? D.pads;
    const rounds = game.rounds ?? D.rounds;
    const slips = game.slips ?? D.slips;
    const sequence: number[] = [];
    for (let i = 0; i < rounds + 1; i++) {
      // Never the same pad twice in a row: a repeat is hard to see as two flashes.
      let pad = Math.floor(ctx.random() * pads);
      if (pad === sequence.at(-1)) pad = (pad + 1) % pads;
      sequence.push(pad);
    }
    return {
      pads,
      rounds,
      sequence,
      step: ctx.ease / (game.pace ?? D.pace),
      slips,
      round: 0,
      phase: 'show',
      clock: 0,
      lit: -1,
      entered: 0,
      slipsLeft: slips,
      last: null,
    };
  },
  update(s, dt) {
    if (s.phase !== 'show') return;
    s.clock += dt;
    const at = s.clock / s.step - LEAD;
    const index = Math.floor(at);
    if (index >= length(s)) {
      s.phase = 'input';
      s.lit = -1;
      return;
    }
    // Each pad is lit for most of its step, with a gap so two pads read as separate flashes.
    s.lit = at >= 0 && at - index < 0.7 ? (s.sequence[index] ?? -1) : -1;
  },
  onInput(s, input) {
    if (input.kind !== 'pick' || s.phase !== 'input') return;
    if (input.index < 0 || input.index >= s.pads) return;
    if (input.index === s.sequence[s.entered]) {
      s.entered += 1;
      s.last = 'hit';
      if (s.entered < length(s)) return;
      s.round += 1;
      if (s.round >= s.rounds) s.phase = 'done';
      else show(s);
      return;
    }
    s.last = 'miss';
    s.slipsLeft -= 1;
    if (s.slipsLeft < 0) s.phase = 'done';
    else show(s);
  },
  result(s) {
    if (s.phase !== 'done') return null;
    const won = s.round >= s.rounds;
    const used = s.slips - Math.max(0, s.slipsLeft);
    return {
      won,
      score: score(won ? 100 - 15 * used : (55 * s.round) / s.rounds),
      values: { rounds: s.round },
    };
  },
});
