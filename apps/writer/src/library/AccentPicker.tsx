import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Field } from '../ui/Field.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';

export const ACCENT_PRESETS = [
  '#4fd1c5',
  '#c98a3d',
  '#e0a458',
  '#e26d5a',
  '#8fa8ff',
  '#c792ea',
] as const;

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Accent dots (28px, ink ring on the active one) + hex input. `undefined` = reader default. */
export function AccentPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange(next: string | undefined): void;
}): ReactNode {
  const { colors } = useTheme();
  const [text, setText] = useState(value ?? '');
  const bad = text.length > 0 && !HEX.test(text);
  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        {ACCENT_PRESETS.map((c) => {
          const on = value === c;
          return (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Accent ${c}`}
              accessibilityState={{ selected: on }}
              hitSlop={8}
              onPress={() => {
                setText(c);
                onChange(c);
              }}
              testID={`accent-${c.slice(1)}`}
              style={[styles.ring, on && { borderColor: colors.ink }]}
            >
              <View style={[styles.dot, { backgroundColor: c }]} />
            </Pressable>
          );
        })}
      </View>
      <Field
        label="Hex colour"
        value={text}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="#4fd1c5"
        error={bad ? 'Use a hex colour like #4fd1c5' : null}
        onChangeText={(t) => {
          setText(t);
          if (HEX.test(t)) onChange(t);
        }}
        testID="accent-hex"
      />
      <View style={styles.reset}>
        <ActionButton
          label="Use reader default"
          variant="ghost"
          onPress={() => {
            setText('');
            onChange(undefined);
          }}
          testID="accent-reset"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  dots: { flexDirection: 'row', gap: space.sm, paddingVertical: space.xxs },
  // 28px dot inside a 36px ring slot; the ring is only visible when active.
  ring: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 28, height: 28, borderRadius: 14 },
  reset: { alignItems: 'flex-start' },
});
