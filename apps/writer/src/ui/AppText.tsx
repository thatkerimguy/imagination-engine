// Text in an M3 type role and colour role.
import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { typescale, type ColorRoles, type TypeRole } from './m3-tokens.ts';
import { useTheme } from './theme.tsx';

export interface AppTextProps extends Omit<TextProps, 'style'> {
  variant?: TypeRole;
  color?: keyof ColorRoles;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
}

export function AppText({
  variant = 'bodyMedium',
  color = 'onSurface',
  style,
  ...rest
}: AppTextProps): ReactNode {
  const { colors } = useTheme();
  return <Text {...rest} style={[typescale[variant], { color: colors[color] }, style]} />;
}
