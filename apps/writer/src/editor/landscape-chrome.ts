// Compact-landscape chrome rule: with the IME open on a short window the metrics ribbon would
// eat the visible writing area, so it auto-collapses. The Author's own choice is never overwritten.
export const COMPACT_LANDSCAPE_MAX_HEIGHT = 500;

export interface LandscapeChromeInput {
  windowWidth: number;
  windowHeight: number;
  keyboardVisible: boolean;
  /** The Author's stored collapse toggle. */
  userCollapsed: boolean;
}

export function shouldAutoCollapseMetrics(i: LandscapeChromeInput): boolean {
  const compactLandscape =
    i.windowWidth > i.windowHeight && i.windowHeight < COMPACT_LANDSCAPE_MAX_HEIGHT;
  return i.keyboardVisible && compactLandscape ? true : i.userCollapsed;
}
