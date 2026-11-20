import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, space, TAP } from './theme.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress(): void;
  variant?: ButtonVariant;
  disabled?: boolean;
  compact?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button(p: ButtonProps): ReactNode {
  const variant = p.variant ?? 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.accessibilityLabel ?? p.label}
      accessibilityState={{ disabled: !!p.disabled }}
      disabled={p.disabled}
      onPress={p.onPress}
      testID={p.testID}
      style={({ pressed }) => [
        styles.base,
        p.compact && styles.compact,
        styles[variant],
        pressed && styles.pressed,
        p.disabled && styles.disabled,
        p.style,
      ]}
    >
      {p.icon}
      <Text
        style={[
          styles.label,
          variant === 'primary' && styles.primaryLabel,
          variant === 'danger' && styles.dangerLabel,
        ]}
      >
        {p.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TAP,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  compact: { minHeight: 36, paddingHorizontal: space.md },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.line },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  label: { color: colors.fg, fontSize: 15, fontWeight: '600' },
  primaryLabel: { color: colors.accentInk },
  dangerLabel: { color: colors.danger },
});
