import type { ReactNode } from 'react';
import { Text, TextInput, View } from 'react-native';
import { colors } from '../../ui/theme.ts';
import { asString } from '../form-state.ts';
import { controlStyles as s } from './styles.ts';
import type { ControlProps } from './types.ts';

export function TextControl({
  field,
  value,
  onChange,
  errors,
}: ControlProps<'text' | 'multiline'>): ReactNode {
  const text = asString(value);
  const multiline = field.type === 'multiline';
  return (
    <View style={s.stack}>
      <TextInput
        testID={`field-${field.key}`}
        accessibilityLabel={field.label}
        value={text}
        onChangeText={onChange}
        placeholder={field.placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[s.input, multiline && s.multiline, errors.length > 0 && s.invalid]}
      />
      {field.maxLength !== undefined ? (
        <Text style={s.counter}>
          {text.length}/{field.maxLength}
        </Text>
      ) : null}
    </View>
  );
}
