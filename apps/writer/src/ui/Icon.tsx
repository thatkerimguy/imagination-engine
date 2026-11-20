// Material Symbols via @expo/vector-icons (bundled with Expo, no UI kit).
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps, ReactNode } from 'react';
import { useTheme } from './theme.tsx';
import type { ColorRoles } from './m3-tokens.ts';

export type IconName = ComponentProps<typeof MaterialIcons>['name'];

export interface IconProps {
  name: IconName;
  size?: number;
  /** A colour role (default onSurfaceVariant) or a literal colour. */
  color?: keyof ColorRoles | `#${string}`;
}

export function Icon({ name, size = 24, color = 'onSurfaceVariant' }: IconProps): ReactNode {
  const { m3 } = useTheme();
  const c = color.startsWith('#') ? color : m3[color as keyof ColorRoles];
  return <MaterialIcons name={name} size={size} color={c} accessible={false} />;
}
