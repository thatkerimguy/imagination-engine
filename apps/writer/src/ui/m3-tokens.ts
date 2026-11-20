// Material Design 3 tokens (m3.material.io): colour roles, the type scale, shape scale and state
// layers. The 12 colour schemes are in themes.ts. Pure data.
import type { TextStyle } from 'react-native';
import { DEFAULT_DARK, DEFAULT_LIGHT, getThemeDef } from './themes.ts';

export interface ColorRoles {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  surface: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  scrim: string;
  inverseSurface: string;
  inverseOnSurface: string;
}

/** System-default schemes (Editorial Teal night / day); the full set lives in themes.ts. */
export const darkColors: ColorRoles = getThemeDef(DEFAULT_DARK).m3;
export const lightColors: ColorRoles = getThemeDef(DEFAULT_LIGHT).m3;

export type TypeRole =
  | 'headlineSmall'
  | 'titleLarge'
  | 'titleMedium'
  | 'titleSmall'
  | 'bodyLarge'
  | 'bodyMedium'
  | 'bodySmall'
  | 'labelLarge'
  | 'labelMedium'
  | 'labelSmall';

const t = (
  fontSize: number,
  lineHeight: number,
  fontWeight: TextStyle['fontWeight'] = '400',
  letterSpacing = 0,
): TextStyle => ({
  fontSize,
  lineHeight,
  fontWeight,
  letterSpacing,
});

export const typescale: Record<TypeRole, TextStyle> = {
  headlineSmall: t(24, 32),
  titleLarge: t(22, 28),
  titleMedium: t(16, 24, '500', 0.15),
  titleSmall: t(14, 20, '500', 0.1),
  bodyLarge: t(16, 24, '400', 0.5),
  bodyMedium: t(14, 20, '400', 0.25),
  bodySmall: t(12, 16, '400', 0.4),
  labelLarge: t(14, 20, '500', 0.1),
  labelMedium: t(12, 16, '500', 0.5),
  labelSmall: t(11, 16, '500', 0.5),
};

/** Editorial exception: the Author's prose and dialogue stay in a literary serif. */
export const proseFont = 'Georgia';

export const shape = {
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 28,
  full: 9999,
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Minimum interactive target (dp). Smaller visuals reach it with hitSlop. */
export const TOUCH = 48;

/** State-layer opacities for pressed / focused / hovered overlays. */
export const stateLayer = { hover: 0.08, focus: 0.1, pressed: 0.12 } as const;

/** Appends an alpha channel to a #rrggbb colour. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return `${hex}${a.toString(16).padStart(2, '0')}`;
}
