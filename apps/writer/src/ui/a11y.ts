// Shared accessibility sizing: every interactive control must reach a 48dp touch area.
import type { Insets } from 'react-native';

export const MIN_TOUCH = 48;

/** hitSlop that grows a visual box of `w x h` dp to the 48dp minimum (never negative). */
export function hitSlopFor(w: number, h: number = w): Insets {
  const x = Math.max(0, (MIN_TOUCH - w) / 2);
  const y = Math.max(0, (MIN_TOUCH - h) / 2);
  return { top: y, bottom: y, left: x, right: x };
}
