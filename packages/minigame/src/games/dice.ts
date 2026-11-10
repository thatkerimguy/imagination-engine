import { MINIGAME_DEFAULTS, type DiceGame } from '@ie/story';
import { defineMinigame, score } from '../types.ts';

export interface DiceState {
  readonly sides: number;
  readonly target: number;
  readonly rerolls: number;
  /** Every roll the game can make, dealt at setup: `rolls[throw][die]`. */
  readonly rolls: readonly (readonly number[])[];
  /** The faces showing; 0 before the first roll. */
  faces: number[];
  /** Dice the reader keeps out of the next roll. */
  held: boolean[];
  /** How many times the dice have been thrown. */
  thrown: number;
  /** Seconds the dice still tumble for; the result waits until they settle. */
  tumbling: number;
}

const D = MINIGAME_DEFAULTS.dice;
const TUMBLE = 0.5;

export const diceTotal = (s: DiceState): number => s.faces.reduce((sum, face) => sum + face, 0);

const settled = (s: DiceState) => s.thrown > 0 && s.tumbling <= 0;
const over = (s: DiceState) => settled(s) && (diceTotal(s) >= s.target || s.thrown > s.rerolls);

/** Roll to reach the target; keep the dice you like and roll the rest again. */
export const dice = defineMinigame<DiceGame, DiceState>({
  id: 'dice',
  setup(game, ctx) {
    const count = game.dice ?? D.dice;
    const sides = game.sides ?? D.sides;
    const rerolls = game.rerolls ?? D.rerolls;
    return {
      sides,
      target: game.target ?? D.target,
      rerolls,
      rolls: Array.from({ length: rerolls + 1 }, () =>
        Array.from({ length: count }, () => 1 + Math.floor(ctx.random() * sides)),
      ),
      faces: Array.from({ length: count }, () => 0),
      held: Array.from({ length: count }, () => false),
      thrown: 0,
      tumbling: 0,
    };
  },
  update(s, dt) {
    if (s.tumbling > 0) s.tumbling = Math.max(0, s.tumbling - dt);
  },
  onInput(s, input) {
    if (s.tumbling > 0 || over(s)) return;
    if (input.kind === 'pick') {
      // Dice can only be kept once they show something.
      if (s.thrown > 0 && input.index >= 0 && input.index < s.held.length)
        s.held[input.index] = !s.held[input.index];
      return;
    }
    if (input.kind !== 'press') return;
    // Keeping every die leaves nothing to roll; that throw would be wasted.
    if (s.thrown > 0 && s.held.every(Boolean)) return;
    const roll = s.rolls[s.thrown] ?? [];
    s.faces = s.faces.map((face, i) => (s.held[i] ? face : (roll[i] ?? face)));
    s.thrown += 1;
    s.tumbling = TUMBLE;
  },
  result(s) {
    if (!over(s)) return null;
    const total = diceTotal(s);
    const won = total >= s.target;
    const spare = s.rerolls - (s.thrown - 1);
    return {
      won,
      score: score(
        won ? (s.rerolls ? 60 + (40 * spare) / s.rerolls : 100) : (55 * total) / s.target,
      ),
      values: { total },
    };
  },
});
