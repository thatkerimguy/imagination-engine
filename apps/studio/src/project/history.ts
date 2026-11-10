/** How many steps Undo can go back. Snapshots share unchanged parts, so each step is small. */
const LIMIT = 300;
/** Edits with the same merge key closer together than this become one undo step (typing). */
const MERGE_MS = 1200;

export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
  readonly mergeKey: string | null;
  readonly mergedAt: number;
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], mergeKey: null, mergedAt: 0 };
}

/**
 * Records a new present. Typing into one field (same `mergeKey`, in quick succession) replaces the
 * present instead of adding a step, so Undo takes back a phrase rather than a letter.
 */
export function record<T>(
  h: History<T>,
  next: T,
  mergeKey: string | null,
  now: number,
): History<T> {
  if (next === h.present) return h;
  const merge = mergeKey !== null && mergeKey === h.mergeKey && now - h.mergedAt < MERGE_MS;
  if (merge) return { ...h, present: next, future: [], mergedAt: now };
  const past = [...h.past, h.present];
  return {
    past: past.length > LIMIT ? past.slice(past.length - LIMIT) : past,
    present: next,
    future: [],
    mergeKey,
    mergedAt: now,
  };
}

export function undo<T>(h: History<T>): History<T> {
  const previous = h.past.at(-1);
  if (previous === undefined) return h;
  return {
    past: h.past.slice(0, -1),
    present: previous,
    future: [h.present, ...h.future],
    mergeKey: null,
    mergedAt: 0,
  };
}

export function redo<T>(h: History<T>): History<T> {
  const [next, ...future] = h.future;
  if (next === undefined) return h;
  return { past: [...h.past, h.present], present: next, future, mergeKey: null, mergedAt: 0 };
}
