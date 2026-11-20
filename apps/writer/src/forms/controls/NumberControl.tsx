import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, space } from '../../ui/legacy-theme.ts';
import { asNumber, snapNumber } from '../form-state.ts';
import { NumberStepper } from './NumberStepper.tsx';
import { controlStyles as s } from './styles.ts';
import type { ControlProps } from './types.ts';

export function NumberControl({
  field,
  value,
  onChange,
  errors,
}: ControlProps<'number'>): ReactNode {
  const num = asNumber(value, field.min);
  const [text, setText] = useState(String(num));
  useEffect(() => setText(String(num)), [num]);

  const commit = (): void => {
    const parsed = Number(text.replace(',', '.'));
    if (text.trim() === '' || !Number.isFinite(parsed)) {
      setText(String(num));
      return;
    }
    const next = snapNumber(parsed, field.min, field.max, field.step);
    setText(String(next));
    onChange(next);
  };

  return (
    <View style={styles.row}>
      <NumberStepper
        value={num}
        min={field.min}
        max={field.max}
        step={field.step}
        unit={field.unit}
        label={field.label}
        onChange={onChange}
      />
      <TextInput
        testID={`field-${field.key}`}
        accessibilityLabel={`${field.label} value`}
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        returnKeyType="done"
        selectTextOnFocus
        style={[s.input, styles.input, errors.length > 0 && s.invalid]}
      />
      <Text style={styles.range}>
        {field.min}–{field.max}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  input: { width: 80, textAlign: 'center' },
  range: { color: colors.muted, fontSize: 12 },
});
