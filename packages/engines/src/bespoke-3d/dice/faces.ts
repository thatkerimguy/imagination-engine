// Shared die facts for every tier. Face order follows three.js BoxGeometry groups:
// +X, -X, +Y, -Y, +Z, -Z. Opposite faces sum to seven, like a real die.
export const FACE_VALUES = [3, 4, 1, 6, 2, 5] as const;

export const FACE_NORMALS: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export function faceIndexOf(value: number): number {
  const i = FACE_VALUES.indexOf(value as (typeof FACE_VALUES)[number]);
  if (i < 0) throw new RangeError(`Not a d6 face: ${value}`);
  return i;
}

/** Pip centres in a unit face, -1..1 on both axes. */
export const PIPS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  1: [[0, 0]],
  2: [
    [-0.5, -0.5],
    [0.5, 0.5],
  ],
  3: [
    [-0.5, -0.5],
    [0, 0],
    [0.5, 0.5],
  ],
  4: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
  ],
  5: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0, 0],
    [-0.5, 0.5],
    [0.5, 0.5],
  ],
  6: [
    [-0.5, -0.55],
    [0.5, -0.55],
    [-0.5, 0],
    [0.5, 0],
    [-0.5, 0.55],
    [0.5, 0.55],
  ],
};

/** A reader-facing name for famous rolls; plain sum otherwise. */
export function describeRoll(values: readonly number[]): string {
  const sum = values.reduce((a, b) => a + b, 0);
  if (values.length === 2 && values[0] === 1 && values[1] === 1) return 'Snake eyes';
  if (values.length === 2 && values[0] === 6 && values[1] === 6) return 'Boxcars';
  if (values.length === 1) return `Rolled ${sum}`;
  return `${values.join(' + ')} = ${sum}`;
}

/** Small deterministic PRNG so a pre-simulation can be replayed or retried with a new seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickOutcome(
  mode: 'scripted' | 'random',
  scripted: readonly number[],
  count: number,
  random: () => number = Math.random,
): number[] {
  return Array.from({ length: count }, (_, i) =>
    mode === 'scripted' && scripted[i] !== undefined ? scripted[i] : 1 + Math.floor(random() * 6),
  );
}
