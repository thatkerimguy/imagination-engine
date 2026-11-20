import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../ui/Button.tsx';
import { Row } from '../ui/layout.tsx';
import { TextField } from '../ui/TextField.tsx';
import { colors, space } from '../ui/theme.ts';

export const ACCENT_PRESETS = [
  '#4fd1c5',
  '#c98a3d',
  '#e0a458',
  '#e26d5a',
  '#8fa8ff',
  '#c792ea',
] as const;

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Accent swatches + hex input. `value` undefined means "use the reader default". */
export function AccentPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange(next: string | undefined): void;
}): ReactNode {
  const [text, setText] = useState(value ?? '');
  const bad = text.length > 0 && !HEX.test(text);
  return (
    <View style={styles.wrap}>
      <Row>
        {ACCENT_PRESETS.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`Accent ${c}`}
            accessibilityState={{ selected: value === c }}
            onPress={() => {
              setText(c);
              onChange(c);
            }}
            testID={`accent-${c.slice(1)}`}
            style={[styles.swatch, { backgroundColor: c }, value === c && styles.selected]}
          />
        ))}
      </Row>
      <TextField
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
      <Button
        label="Use reader default"
        variant="ghost"
        compact
        onPress={() => {
          setText('');
          onChange(undefined);
        }}
        testID="accent-reset"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.line },
  selected: { borderColor: colors.fg },
});
