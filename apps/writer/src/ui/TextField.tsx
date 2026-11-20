// M3 outlined text field: 1dp outline → 2dp primary on focus, error outline + supporting text.
import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { AppText } from './AppText.tsx';
import { shape, space, typescale } from './m3-tokens.ts';
import { useTheme } from './theme.tsx';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  /** Supporting text under the field. */
  help?: string;
  error?: string | null;
  /** Trailing supporting text, e.g. a character counter or range hint. */
  trailingHelp?: string;
  dense?: boolean;
}

export function TextField(p: TextFieldProps): ReactNode {
  const { label, help, error, trailingHelp, dense, multiline, onFocus, onBlur, ...input } = p;
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const border = error ? colors.error : focused ? colors.primary : colors.outline;
  // A 2dp border eats 1dp of padding so text never shifts when the field gains focus.
  const thick = focused || !!error;
  const pad = {
    paddingHorizontal: 16 - (thick ? 1 : 0),
    paddingVertical: (dense ? 10 : 15) - (thick ? 1 : 0),
  };
  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText
          variant="labelLarge"
          color={error ? 'error' : focused ? 'primary' : 'onSurfaceVariant'}
        >
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={colors.onSurfaceVariant}
        multiline={multiline}
        accessibilityLabel={label}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          typescale.bodyLarge,
          styles.input,
          dense && styles.dense,
          multiline && styles.multiline,
          pad,
          { color: colors.onSurface, borderColor: border, borderWidth: thick ? 2 : 1 },
        ]}
      />
      {error || help || trailingHelp ? (
        <View style={styles.support}>
          <AppText
            variant="bodySmall"
            color={error ? 'error' : 'onSurfaceVariant'}
            style={styles.flex}
          >
            {error ?? help ?? ''}
          </AppText>
          {trailingHelp ? (
            <AppText variant="bodySmall" color="onSurfaceVariant">
              {trailingHelp}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    minHeight: 56,
    borderRadius: shape.extraSmall,
  },
  dense: { minHeight: 44 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  support: { flexDirection: 'row', gap: space.lg, paddingHorizontal: space.lg },
  flex: { flex: 1 },
});
