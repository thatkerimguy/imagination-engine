// Folio field: compact label above, quiet `surface` input (10px radius) that gains a crisp 1.5px
// accent ring on focus, and a muted hint / error line below. Text never shifts on focus.
import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Txt } from './Txt.tsx';
import { radius, space } from './tokens.ts';
import { useTheme } from './theme.tsx';
import { type as typeScale } from './type.ts';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  /** Quiet supporting text under the field. */
  hint?: string;
  error?: string | null;
  /** Right-aligned supporting text, e.g. a counter or range. */
  trailingHint?: string;
  /** 36dp single-line height instead of 44dp. */
  dense?: boolean;
  /** Serif input text (titles, prose-like fields). */
  serif?: boolean;
}

export function Field(p: FieldProps): ReactNode {
  const { label, hint, error, trailingHint, dense, serif, multiline, onFocus, onBlur, ...input } =
    p;
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const message = error?.trim() || hint;
  const ring = error ? colors.danger : focused ? colors.accent : 'transparent';
  return (
    <View style={styles.wrap}>
      {label ? (
        <Txt variant="label" color={error ? 'danger' : 'inkSecondary'}>
          {label}
        </Txt>
      ) : null}
      <View
        style={[
          styles.box,
          { backgroundColor: colors.surface, borderColor: ring },
          !focused && !error && { borderColor: colors.hairline, borderWidth: 1, padding: 0.5 },
        ]}
      >
        <TextInput
          {...input}
          multiline={multiline}
          placeholderTextColor={colors.inkMuted}
          selectionColor={colors.accent}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            serif ? typeScale.serifBody : typeScale.body,
            styles.input,
            { color: colors.ink, minHeight: multiline ? 88 : dense ? 33 : 41 },
            dense && styles.dense,
            multiline && styles.multi,
          ]}
        />
      </View>
      {message || trailingHint ? (
        <View style={styles.hints}>
          <Txt variant="caption" color={error?.trim() ? 'danger' : 'inkMuted'} style={styles.flex}>
            {message ?? ''}
          </Txt>
          {trailingHint ? (
            <Txt variant="caption" color="inkMuted">
              {trailingHint}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  box: { borderRadius: radius.sm, borderWidth: 1.5 },
  input: { paddingHorizontal: space.sm, paddingVertical: 10 },
  dense: { paddingVertical: 6 },
  multi: { textAlignVertical: 'top' },
  hints: { flexDirection: 'row', gap: space.xs },
  flex: { flex: 1 },
});
