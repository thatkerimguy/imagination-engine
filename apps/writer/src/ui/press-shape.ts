// Pure press-geometry helpers: every pressed wash / Android ripple must clip to the exact visual
// box and corner radius of the control (never a floating rectangle inside a rounded card).
import type { ViewStyle } from 'react-native';
import { radius } from './tokens.ts';

/** Radius of a rounded card (CardGroup) - rows inside clip to it. */
export const CARD_RADIUS = radius.md;

/** Clip a surface to its own rounded corners. */
export function clipped(r: number): ViewStyle {
  return { borderRadius: r, overflow: 'hidden' };
}

/** Centered circular visible box (icon buttons): radius is exactly half the size. */
export function circleBox(size: number): ViewStyle {
  return { width: size, height: size, ...clipped(size / 2) };
}

/** Bounded (non-borderless) ripple that stays inside the surface. */
export function boundedRipple(color: string): { color: string; borderless: false } {
  return { color, borderless: false };
}

/** Adds `overflow: 'hidden'` to a flattened style that has a radius but no explicit overflow. */
export function withClip(flat: ViewStyle | undefined): ViewStyle | null {
  if (!flat || !flat.borderRadius || flat.overflow !== undefined) return null;
  return { overflow: 'hidden' };
}
