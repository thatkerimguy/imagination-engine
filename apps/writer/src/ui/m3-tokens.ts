// Material Design 3 tokens (m3.material.io): colour roles for a teal-seed (#4FD1C5) scheme with a
// warm amber tertiary (#E0A458), the type scale, shape scale and state layers. Pure data.
import type { TextStyle } from 'react-native';

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

export const darkColors: ColorRoles = {
  primary: '#5FD8CB',
  onPrimary: '#003733',
  primaryContainer: '#00504A',
  onPrimaryContainer: '#9EF2E6',
  secondary: '#B1CCC7',
  onSecondary: '#1C3532',
  secondaryContainer: '#334B48',
  onSecondaryContainer: '#CCE8E3',
  tertiary: '#F4BD72',
  onTertiary: '#452B00',
  tertiaryContainer: '#633F00',
  onTertiaryContainer: '#FFDDB6',
  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  surface: '#101414',
  surfaceContainerLowest: '#0B0F0F',
  surfaceContainerLow: '#181C1C',
  surfaceContainer: '#1C2020',
  surfaceContainerHigh: '#272B2B',
  surfaceContainerHighest: '#313635',
  onSurface: '#DEE4E2',
  onSurfaceVariant: '#BEC9C6',
  outline: '#889391',
  outlineVariant: '#3F4947',
  scrim: '#000000',
  inverseSurface: '#DEE4E2',
  inverseOnSurface: '#2B3130',
};

export const lightColors: ColorRoles = {
  primary: '#006A63',
  onPrimary: '#FFFFFF',
  primaryContainer: '#9EF2E6',
  onPrimaryContainer: '#00201D',
  secondary: '#4A6360',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#CCE8E3',
  onSecondaryContainer: '#051F1D',
  tertiary: '#825500',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFDDB6',
  onTertiaryContainer: '#2A1800',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',
  surface: '#F5FAF9',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#EFF5F4',
  surfaceContainer: '#E9EFEE',
  surfaceContainerHigh: '#E4EAE8',
  surfaceContainerHighest: '#DEE4E2',
  onSurface: '#171D1C',
  onSurfaceVariant: '#3F4947',
  outline: '#6F7977',
  outlineVariant: '#BEC9C6',
  scrim: '#000000',
  inverseSurface: '#2B3130',
  inverseOnSurface: '#ECF2F0',
};

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
