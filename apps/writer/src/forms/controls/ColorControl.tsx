import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip } from '../../ui/Chip.tsx';
import { Row } from '../../ui/layout.tsx';
import { colors, space } from '../../ui/legacy-theme.ts';
import { tapFeedback } from '../../ui/haptics.ts';
import { asString } from '../form-state.ts';
import { controlStyles as s } from './styles.ts';
import type { ControlProps } from './types.ts';

const DEFAULT_SWATCHES = [
  '#e26d5a',
  '#e0a458',
  '#f2d65c',
  '#7bc47f',
  '#4fd1c5',
  '#5aa9e2',
  '#8f7be2',
  '#e27bc0',
  '#e7e4dd',
  '#9b968d',
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

export function ColorControl({ field, value, onChange, errors }: ControlProps<'color'>): ReactNode {
  const hex = asString(value);
  const swatches = field.swatches ?? DEFAULT_SWATCHES;
  return (
    <View style={s.stack}>
      <Row>
        {swatches.map((c) => (
          <Chip
            key={c}
            label={c}
            dot={c}
            selected={hex.toLowerCase() === c.toLowerCase()}
            onPress={() => {
              tapFeedback();
              onChange(c);
            }}
          />
        ))}
      </Row>
      <View style={styles.hexRow}>
        <Text style={[styles.dot, { color: HEX.test(hex) ? hex : colors.line }]}>●</Text>
        <TextInput
          testID={`field-${field.key}`}
          accessibilityLabel={`${field.label} hex`}
          value={hex}
          onChangeText={(t) => onChange(t.startsWith('#') || t === '' ? t : `#${t}`)}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={7}
          placeholder="#rrggbb"
          placeholderTextColor={colors.muted}
          style={[s.input, styles.hex, errors.length > 0 && s.invalid]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { fontSize: 28 },
  hex: { width: 120, fontFamily: 'Menlo' },
});
