// Pure gesture / index math for RootTabsPager (Library · Notes · Search). No react-native import,
// so every threshold is unit-testable (tab-pager-math.test.ts).

/** Library, Notes, Search — the TAB_ROOTS order. */
export const TAB_COUNT = 3;
/** Swipes starting this close to either screen edge belong to the Android system back gesture. */
export const EDGE_DEAD_ZONE = 32;
/** Horizontal travel (dp) before the pager claims a gesture. */
export const SWIPE_MIN_DX = 16;
/** |dx| must beat |dy| by this factor, so vertical scrolling never stutters. */
export const INTENT_RATIO = 1.5;
/** Fraction of the page width that commits a slow drag to the neighbouring tab. */
export const DISTANCE_THRESHOLD = 0.25;
/** Release velocity (dp/ms) that commits a short flick. */
export const FLICK_VELOCITY = 0.5;
/** Drag resistance past the first / last tab. */
export const EDGE_RESISTANCE = 0.3;

export const clampIndex = (i: number): number => Math.max(0, Math.min(TAB_COUNT - 1, i));

export function inEdgeDeadZone(startX: number, width: number): boolean {
  return startX < EDGE_DEAD_ZONE || startX > width - EDGE_DEAD_ZONE;
}

export function isHorizontalIntent(dx: number, dy: number): boolean {
  return Math.abs(dx) > SWIPE_MIN_DX && Math.abs(dx) > Math.abs(dy) * INTENT_RATIO;
}

/** Whether the pager should take over a move that started at `startX`. */
export function shouldClaimSwipe(startX: number, dx: number, dy: number, width: number): boolean {
  return width > 0 && !inEdgeDeadZone(startX, width) && isHorizontalIntent(dx, dy);
}

/** Row translateX while the finger is down: follows 1:1, resisting past either end. */
export function dragOffset(index: number, dx: number, width: number): number {
  const base = -index * width;
  const pastStart = index === 0 && dx > 0;
  const pastEnd = index === TAB_COUNT - 1 && dx < 0;
  return base + (pastStart || pastEnd ? dx * EDGE_RESISTANCE : dx);
}

/** The tab to settle on after release (dx > 0 = finger moved right = previous tab). */
export function snapTarget(index: number, dx: number, vx: number, width: number): number {
  const far = width > 0 && Math.abs(dx) > width * DISTANCE_THRESHOLD;
  const flick = Math.abs(vx) > FLICK_VELOCITY && Math.sign(vx) === Math.sign(dx);
  if (!far && !flick) return index;
  return clampIndex(index + (dx > 0 ? -1 : 1));
}

/** Android back on the root shell: Notes / Search unwind to Library; Library (null) exits. */
export function rootBackTarget(index: number): number | null {
  return index === 0 ? null : 0;
}
