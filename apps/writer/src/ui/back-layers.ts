// Pure Android back / predictive-back routing (no react-native import, so it is unit-testable).
// Modal-based layers (Sheet, ConfirmDialog, PopoverMenu) get back natively via `onRequestClose`;
// these helpers cover the inline layers a Modal does not own: Find/Replace, the colour popover and
// Focus Mode in the editors, and the Master Lock overlay.

export interface BackLayer {
  /** Whether this layer is showing and should be closed by back. */
  open: boolean;
  close(): void;
}

/**
 * The layer back should close: the first open one, with `layers` listed topmost first. Null means
 * back falls through to the navigator (pop the route). While the Master Lock covers the app the
 * editor never closes layers hidden behind the overlay; LockGate consumes back itself.
 */
export function topOpenLayer(layers: readonly BackLayer[], locked: boolean): BackLayer | null {
  if (locked) return null;
  return layers.find((l) => l.open) ?? null;
}

/** Handles one back press: closes the topmost open layer and reports whether back was consumed. */
export function handleBackPress(layers: readonly BackLayer[], locked: boolean): boolean {
  const layer = topOpenLayer(layers, locked);
  if (!layer) return false;
  layer.close();
  return true;
}

/**
 * The lock overlay consumes back while it covers the app, so a back gesture can neither pop the
 * routes under it nor animate a predictive-back peek of the manuscript behind it.
 */
export function lockGateConsumesBack(covered: boolean): boolean {
  return covered;
}
