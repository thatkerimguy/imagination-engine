import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { enabledWriterModules } from '../modules/registry.ts';
import { colors } from '../ui/legacy-theme.ts';

/** Compact "Gimmicks: 🎲 🧠" line of enabled module icons; tapping opens novel settings. */
export function GimmickLine({
  enabled,
  onPress,
}: {
  enabled: readonly string[];
  onPress(): void;
}): ReactNode {
  const icons = enabledWriterModules(enabled).map((m) => m.meta.icon);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Gimmick modules"
      testID="outline-gimmicks"
    >
      <Text style={styles.text}>Gimmicks: {icons.length ? icons.join(' ') : 'none yet'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({ text: { color: colors.muted, fontSize: 14 } });
