import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, space } from './theme.ts';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?(): void;
  /** Optional leading colour dot (e.g. a swatch or dialogue accent). */
  dot?: string;
  testID?: string;
}

export function Chip({ label, selected, onPress, dot, testID }: ChipProps): ReactNode {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
      hitSlop={4}
    >
      {dot ? <Text style={[styles.dot, { color: dot }]}>●</Text> : null}
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  pressed: { opacity: 0.75 },
  dot: { fontSize: 12 },
  label: { color: colors.fg, fontSize: 14, fontWeight: '500' },
  selectedLabel: { color: colors.accentInk, fontWeight: '700' },
});
