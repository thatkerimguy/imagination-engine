// Folio text: a type variant (serif titles, sans chrome) in a Folio colour role.
import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import type { FolioColors } from './palette.ts';
import { useTheme } from './theme.tsx';
import { type, type TypeVariant } from './type.ts';

export type InkRole = keyof FolioColors;

export interface TxtProps extends Omit<TextProps, 'style'> {
  variant?: TypeVariant;
  /** A Folio colour role (default `ink`) or a literal #hex. */
  color?: InkRole | `#${string}`;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
}

export function Txt({ variant = 'body', color = 'ink', style, ...rest }: TxtProps): ReactNode {
  const { colors } = useTheme();
  const c = color.startsWith('#') ? color : colors[color as InkRole];
  return <Text {...rest} style={[type[variant], { color: c }, style]} />;
}
