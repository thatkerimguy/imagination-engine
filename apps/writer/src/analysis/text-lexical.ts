// Vocabulary helpers: syllable heuristic and MATTR.

const EXCEPTIONS: Readonly<Record<string, number>> = {
  the: 1,
  area: 3,
  idea: 3,
  real: 1,
  really: 2,
  being: 2,
  doing: 2,
  going: 2,
  seeing: 2,
  every: 2,
  everyone: 3,
  different: 3,
  family: 3,
  evening: 2,
  business: 2,
  several: 3,
  people: 2,
  little: 2,
  whole: 1,
  quiet: 2,
  science: 2,
  poem: 2,
  poet: 2,
  create: 2,
  video: 3,
  radio: 3,
  ocean: 2,
  lion: 2,
  giant: 2,
  diet: 2,
  fire: 1,
  hour: 1,
  our: 1,
  tired: 1,
  wired: 1,
  hired: 1,
  aged: 1,
  beloved: 3,
  naked: 2,
  wicked: 2,
  learned: 1,
};

/** Syllables in one word-token (hyphen parts summed); minimum 1. */
export function countSyllables(token: string): number {
  const parts = token.toLowerCase().split(/[-]/);
  let total = 0;
  for (const part of parts) total += partSyllables(part.replace(/[^\p{L}]/gu, ''));
  return Math.max(1, total);
}

function partSyllables(w: string): number {
  if (!w) return 0;
  const known = EXCEPTIONS[w];
  if (known !== undefined) return known;
  if (w.length <= 3) return 1;
  // Silent endings: -es (not after s x z c g h), -ed (not after t d), final -e (not -le).
  const trimmed = w
    .replace(/(?:[^laeiouysxzcgh]es|(?<![td])ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '');
  return Math.max(1, trimmed.match(/[aeiouy]+/g)?.length ?? 0);
}

export const MATTR_WINDOW = 50;

/** Moving-average type-token ratio (0–100) with an O(N) sliding frequency map. */
export function mattr(tokens: readonly string[], window = MATTR_WINDOW): number {
  const n = tokens.length;
  if (n === 0) return 0;
  if (n < window) return (new Set(tokens).size / n) * 100;
  const freq = new Map<string, number>();
  let distinct = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const add = tokens[i]!;
    const c = freq.get(add) ?? 0;
    if (c === 0) distinct++;
    freq.set(add, c + 1);
    if (i >= window) {
      const out = tokens[i - window]!;
      const oc = freq.get(out)!;
      if (oc === 1) {
        freq.delete(out);
        distinct--;
      } else freq.set(out, oc - 1);
    }
    if (i >= window - 1) sum += distinct / window;
  }
  return (sum / (n - window + 1)) * 100;
}
