import { MINIGAME_DEFAULTS, type SliderGame } from '@ie/story';
import { defineMinigame, score, type Direction } from '../types.ts';

export interface SliderState {
  readonly size: number;
  /** Moves the puzzle was mixed by: the fewest it could take, roughly. */
  readonly mixed: number;
  /** Seconds allowed, or 0 for no clock. */
  readonly limit: number;
  /** The tile in each cell, row by row; 0 is the gap. */
  tiles: number[];
  moves: number;
  elapsed: number;
}

const D = MINIGAME_DEFAULTS.slider;

/** Where the gap goes for each direction a tile is pushed: the tile comes from the other side. */
const FROM: Readonly<Record<Direction, readonly [number, number]>> = {
  up: [0, 1],
  down: [0, -1],
  left: [1, 0],
  right: [-1, 0],
};

export function sliderSolved(tiles: readonly number[]): boolean {
  return tiles.every((tile, i) => tile === (i === tiles.length - 1 ? 0 : i + 1));
}

/** Slides the tile at `cell` into the gap when it sits next to it. Returns whether it moved. */
function slide(s: SliderState, cell: number): boolean {
  const gap = s.tiles.indexOf(0);
  if (cell < 0 || cell >= s.tiles.length) return false;
  const dx = Math.abs((cell % s.size) - (gap % s.size));
  const dy = Math.abs(Math.floor(cell / s.size) - Math.floor(gap / s.size));
  if (dx + dy !== 1) return false;
  s.tiles[gap] = s.tiles[cell] ?? 0;
  s.tiles[cell] = 0;
  return true;
}

/** The cell whose tile a direction pushes into the gap, or -1 at an edge. */
function cellFor(s: SliderState, dir: Direction): number {
  const gap = s.tiles.indexOf(0);
  const x = (gap % s.size) + FROM[dir][0];
  const y = Math.floor(gap / s.size) + FROM[dir][1];
  return x < 0 || y < 0 || x >= s.size || y >= s.size ? -1 : y * s.size + x;
}

const timedOut = (s: SliderState) => s.limit > 0 && s.elapsed >= s.limit;
const over = (s: SliderState) => sliderSolved(s.tiles) || timedOut(s);

/** Slide numbered tiles until they read in order with the gap last. */
export const slider = defineMinigame<SliderGame, SliderState>({
  id: 'slider',
  setup(game, ctx) {
    const size = game.size ?? D.size;
    const mixed = game.shuffle ?? D.shuffle;
    const state: SliderState = {
      size,
      mixed,
      limit: game.seconds === undefined ? 0 : game.seconds * ctx.ease,
      tiles: Array.from({ length: size * size }, (_, i) => (i === size * size - 1 ? 0 : i + 1)),
      moves: 0,
      elapsed: 0,
    };
    // Mixing by legal moves keeps the puzzle solvable; never straight back the way it came.
    let last = -1;
    for (let done = 0; done < mixed || sliderSolved(state.tiles);) {
      const gap = state.tiles.indexOf(0);
      const options = [gap - size, gap + size, gap - 1, gap + 1].filter((cell) => cell !== last);
      const cell = options[Math.floor(ctx.random() * options.length)] ?? -1;
      if (!slide(state, cell)) continue;
      last = gap;
      done += 1;
    }
    return state;
  },
  update(s, dt) {
    if (!over(s)) s.elapsed += dt;
  },
  onInput(s, input) {
    if (over(s)) return;
    const cell =
      input.kind === 'pick' ? input.index : input.kind === 'dir' ? cellFor(s, input.dir) : -1;
    if (slide(s, cell)) s.moves += 1;
  },
  result(s) {
    if (!over(s)) return null;
    const won = sliderSolved(s.tiles);
    const values = { moves: s.moves, seconds: Math.round(s.elapsed) };
    if (!won) {
      const placed = s.tiles.filter((tile, i) => tile !== 0 && tile === i + 1).length;
      return { won, score: score((55 * placed) / (s.tiles.length - 1)), values };
    }
    // Timed: how much time was left. Untimed: how close to the mixing count the solve was.
    const points = s.limit
      ? 60 + 40 * (1 - s.elapsed / s.limit)
      : Math.max(50, 100 - Math.max(0, s.moves - s.mixed));
    return { won, score: score(points), values };
  },
  timeLeft: (s) => (s.limit ? Math.max(0, 1 - s.elapsed / s.limit) : null),
});
