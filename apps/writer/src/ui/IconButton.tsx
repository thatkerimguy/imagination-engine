// M3 icon button: 40dp visual, 48dp touch target. Standard (no fill) or filled-tonal.
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Icon, type IconName } from './Icon.tsx';
import { shape, type ColorRoles } from './m3-tokens.ts';
import { slopFor, StatePressable } from './StateLayer.tsx';
import { useTheme } from './theme.tsx';

export interface IconButtonProps {
  icon: IconName;
  /** Required: icon-only controls must be labelled for screen readers. */
  accessibilityLabel: string;
  onPress(): void;
  variant?: 'standard' | 'tonal';
  color?: keyof ColorRoles;
  /** Visual size; the touch target is always at least 48dp. */
  size?: 40 | 32;
  selected?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function IconButton(p: IconButtonProps): ReactNode {
  const { m3 } = useTheme();
  const size = p.size ?? 40;
  const tonal = p.variant === 'tonal' || p.selected;
  const fg: keyof ColorRoles = p.color ?? (tonal ? 'onSecondaryContainer' : 'onSurfaceVariant');
  return (
    <StatePressable
      accessibilityRole="button"
      accessibilityLabel={p.accessibilityLabel}
      accessibilityState={{ disabled: !!p.disabled, selected: p.selected }}
      disabled={p.disabled}
      onPress={p.onPress}
      testID={p.testID}
      hitSlop={slopFor(size)}
      layerColor={m3[fg]}
      style={[
        styles.base,
        { width: size, height: size },
        tonal && { backgroundColor: m3.secondaryContainer },
        p.disabled && styles.disabled,
      ]}
    >
      <Icon name={p.icon} size={size === 40 ? 24 : 20} color={fg} />
    </StatePressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: shape.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.38 },
});
