/** Seeded generator (mulberry32). The state is one uint32, so it fits in a JSON save. */
export function nextRandom(state: number): { readonly value: number; readonly state: number } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}

export interface Dice {
  readonly count: number;
  readonly sides: number;
}

export function parseDice(notation: string): Dice {
  const match = /^(\d{1,2})d(\d{1,3})$/.exec(notation);
  const count = Number(match?.[1]);
  const sides = Number(match?.[2]);
  if (!match || count < 1 || sides < 2)
    throw new Error(`"${notation}" isn't dice notation like 1d20 or 2d6.`);
  return { count, sides };
}

/** Exact chance that the dice total plus `modifier` reaches `target`. */
export function successChance(dice: Dice, modifier: number, target: number): number {
  // Distribution of the dice total, built one die at a time.
  let dist = [1];
  for (let d = 0; d < dice.count; d++) {
    const next = new Array<number>(dist.length + dice.sides).fill(0);
    dist.forEach((p, total) => {
      for (let face = 1; face <= dice.sides; face++)
        next[total + face] = (next[total + face] ?? 0) + p / dice.sides;
    });
    dist = next;
  }
  return dist.reduce((sum, p, total) => (total + modifier >= target ? sum + p : sum), 0);
}
