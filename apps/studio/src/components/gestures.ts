/*
 * The arithmetic behind the canvas gestures (pinch, ctrl+wheel, drag to pan), kept pure so it is
 * tested without a DOM. Scales are "pixels per content unit": 1 for the Flow at 100%, pixels per
 * beat for the timeline.
 */

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Where to scroll after a zoom so the content under `anchor` (a point in the scroller's own box)
 * stays under it. Works per axis.
 */
export function scrollForZoom(
  scroll: number,
  anchor: number,
  oldScale: number,
  newScale: number,
): number {
  const content = (scroll + anchor) / oldScale;
  return Math.max(0, content * newScale - anchor);
}

/** The scale a pinch asks for: the start scale times how far the fingers spread. */
export function pinchScale(
  startScale: number,
  startDistance: number,
  distance: number,
  min: number,
  max: number,
): number {
  if (startDistance <= 0) return startScale;
  return clamp(startScale * (distance / startDistance), min, max);
}

/**
 * One wheel notch (or trackpad pinch, which browsers send as ctrl+wheel) as a zoom factor.
 * Line-mode deltas (Firefox) are about 16 pixels each.
 */
export function wheelFactor(deltaY: number, deltaMode = 0): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaY;
  return Math.exp(clamp(-pixels, -240, 240) * 0.0025);
}

/** The nearest of the fixed zoom steps, for the +/- buttons after a free pinch. */
export function stepFrom(steps: readonly number[], scale: number, direction: 1 | -1): number {
  if (direction > 0) return steps.find((s) => s > scale + 1e-6) ?? steps[steps.length - 1] ?? scale;
  const lower = steps.filter((s) => s < scale - 1e-6);
  return lower[lower.length - 1] ?? steps[0] ?? scale;
}

export const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

export const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
