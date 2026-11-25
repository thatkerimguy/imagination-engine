// Pure keyboard/navbar dock math, shared by ChapterEditor and NoteEditor (no react-native import,
// so it is unit-testable in node).

/**
 * How far the bottom dock must rise above the root's bottom edge to sit on the keyboard.
 * iOS never resizes the window, so the whole keyboard height is the offset. Android either
 * overlays the keyboard (Android 15 edge-to-edge: the root keeps its full height) or shrinks the
 * window (`adjustResize` OEMs): only the part the OS did not already absorb is added, so the
 * toolbar never floats a keyboard-height gap above the keys.
 */
export function computeKeyboardOffset(
  platform: string,
  keyboardHeight: number,
  fullHeight: number,
  currentHeight: number,
): number {
  if (platform === 'ios') return Math.max(0, keyboardHeight);
  if (platform !== 'android') return 0;
  const shrunkBy = Math.max(0, fullHeight - currentHeight);
  return Math.max(0, keyboardHeight - shrunkBy);
}

/**
 * Page IME reveal: the scroll offset that lifts a focused field (window-space bottom edge
 * `fieldBottom`) to `margin` dp above the keyboard's top edge, or null when it already clears.
 */
export function computeRevealScroll(
  fieldBottom: number,
  keyboardTop: number,
  scrollY: number,
  margin = 24,
): number | null {
  const overlap = fieldBottom + margin - keyboardTop;
  return overlap > 0 ? Math.max(0, scrollY + overlap) : null;
}
