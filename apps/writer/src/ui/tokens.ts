// Folio design tokens: radii, spacing, sizes, touch targets and colour helpers. Colour roles live
// in palette.ts / themes.ts; the type scale in type.ts. Pure data (type-only react-native import).
import type { ViewStyle } from 'react-native';

export const radius = { xs: 6, sm: 10, md: 14, lg: 16, sheet: 20, pill: 999 } as const;

/** 4-based spacing scale. `gutter` is the mobile page margin. */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  gutter: 20,
} as const;

/** Minimum interactive target (dp). Smaller visuals reach it with hitSlop. */
export const TOUCH = 44;

/** Hairline stroke (dp). */
export const HAIRLINE = 1;

/** UI sans sizes. */
export const size = { xs: 11, sm: 13, md: 15, lg: 17, xl: 22, display: 28 } as const;

/** Appends an alpha channel to a #rrggbb colour. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return `${hex}${a.toString(16).padStart(2, '0')}`;
}

/** Subtle elevation for popovers / segment thumbs. */
export function lift(dark: boolean, level: 1 | 2 = 1): ViewStyle {
  return {
    shadowColor: '#000',
    shadowOpacity: dark ? 0.5 : level === 1 ? 0.08 : 0.16,
    shadowRadius: level === 1 ? 2 : 16,
    shadowOffset: { width: 0, height: level === 1 ? 1 : 6 },
    elevation: level === 1 ? 1 : 6,
  };
}
