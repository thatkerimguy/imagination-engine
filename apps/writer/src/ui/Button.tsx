// M3 common buttons: filled, tonal, outlined, text (40dp visual, 48dp target, full shape).
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { shape, space, type ColorRoles } from './m3-tokens.ts';
import { slopFor, StatePressable } from './StateLayer.tsx';
import { useTheme } from './theme.tsx';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';

export interface ButtonProps {
  label: string;
  onPress(): void;
  variant?: ButtonVariant;
  icon?: IconName;
  /** Error-coloured text / outline (destructive text & outlined buttons). */
  destructive?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const ROLES: Record<ButtonVariant, { bg?: keyof ColorRoles; fg: keyof ColorRoles }> = {
  filled: { bg: 'primary', fg: 'onPrimary' },
  tonal: { bg: 'secondaryContainer', fg: 'onSecondaryContainer' },
  outlined: { fg: 'primary' },
  text: { fg: 'primary' },
};

export function Button(p: ButtonProps): ReactNode {
  const { colors } = useTheme();
  const variant = p.variant ?? 'filled';
  const role = ROLES[variant];
  const fg: keyof ColorRoles = p.destructive && !role.bg ? 'error' : role.fg;
  return (
    <StatePressable
      accessibilityRole="button"
      accessibilityLabel={p.accessibilityLabel ?? p.label}
      accessibilityState={{ disabled: !!p.disabled }}
      disabled={p.disabled}
      onPress={p.onPress}
      testID={p.testID}
      hitSlop={slopFor(0, 40)}
      layerColor={colors[fg]}
      style={[
        styles.base,
        variant === 'text' ? styles.textPad : p.icon ? styles.iconPad : styles.pad,
        role.bg ? { backgroundColor: colors[role.bg] } : null,
        variant === 'outlined' && {
          borderWidth: 1,
          borderColor: p.destructive ? colors.error : colors.outline,
        },
        p.disabled && styles.disabled,
        p.style,
      ]}
    >
      <View style={styles.row}>
        {p.icon ? <Icon name={p.icon} size={18} color={fg} /> : null}
        <AppText variant="labelLarge" color={fg} numberOfLines={1}>
          {p.label}
        </AppText>
      </View>
    </StatePressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 40,
    borderRadius: shape.full,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  pad: { paddingHorizontal: space.xl },
  iconPad: { paddingLeft: space.lg, paddingRight: space.xl },
  textPad: { paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  disabled: { opacity: 0.38 },
});
