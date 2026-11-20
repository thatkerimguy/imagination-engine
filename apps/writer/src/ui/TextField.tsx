import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, space } from './theme.ts';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  help?: string;
  error?: string | null;
}

/** Labelled text input with help text and an error line. */
export function TextField({ label, help, error, multiline, ...input }: TextFieldProps): ReactNode {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        multiline={multiline}
        accessibilityLabel={label}
        {...input}
        style={[styles.input, multiline && styles.multiline, !!error && styles.invalid]}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : help ? (
        <Text style={styles.help}>{help}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: colors.fg, fontSize: 14, fontWeight: '600' },
  input: {
    minHeight: 44,
    color: colors.fg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 16,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  invalid: { borderColor: colors.danger },
  help: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, fontSize: 12, fontWeight: '600' },
});
