// Material 3 window size classes for the large-screen layout (DIRECTIVE-03). Pure classifier
// (unit tested, no react-native import); the hook lives in use-layout-class.ts.

export type LayoutClass = 'compact' | 'medium' | 'expanded';

export const MEDIUM_MIN = 600;
export const EXPANDED_MIN = 840;
/** Readable measure for prose and forms on Medium / Expanded windows. */
export const READING_MAX = 720;
/** Width of the Expanded split-pane reference drawer. */
export const REFERENCE_PANE_WIDTH = 380;

export function layoutClassFor(width: number): LayoutClass {
  if (width >= EXPANDED_MIN) return 'expanded';
  return width >= MEDIUM_MIN ? 'medium' : 'compact';
}

/** Library / Notes grid columns: 1 compact, 2 medium, 3 expanded. */
export function gridColumns(cls: LayoutClass): number {
  return cls === 'expanded' ? 3 : cls === 'medium' ? 2 : 1;
}

/** True when the left navigation rail replaces the bottom tab bar. */
export const usesRail = (cls: LayoutClass): boolean => cls !== 'compact';
