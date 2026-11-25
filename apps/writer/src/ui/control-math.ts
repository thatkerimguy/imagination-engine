// Pure helpers for the Folio controls (no react-native), so they can be unit-tested in node.
export interface Seg {
  x: number;
  w: number;
}

export const SLIDE_MS = 180;

/** Thumb translateX for a measured segment (pulled back one hairline to cover the seg border). */
export const thumbTarget = (seg: Seg, hairline: number): number => seg.x - hairline;

export type SlideAction = 'place' | 'slide' | 'none';

/**
 * What the thumb should do for a new target: first measurement places it without animating, a
 * changed target slides, an identical one (e.g. onLayout re-reporting the same width) does nothing.
 */
export function slideAction(last: number | null, next: number): SlideAction {
  if (last === null) return 'place';
  return last === next ? 'none' : 'slide';
}

/** Keeps a measured-segment map referentially stable when a layout reports the same box. */
export function mergeSeg(
  m: Record<string, Seg>,
  key: string,
  x: number,
  w: number,
): Record<string, Seg> {
  const old = m[key];
  return old && old.x === x && old.w === w ? m : { ...m, [key]: { x, w } };
}

/**
 * Optimistic value: follows the parent whenever it changes externally, and a tap overrides it
 * immediately (before the parent re-renders).
 */
export function syncOptimistic<T>(current: T, prevExternal: T, external: T): T {
  return prevExternal === external ? current : external;
}
