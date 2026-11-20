import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Field } from '../../ui/Field.tsx';
import { Press, slop } from '../../ui/Press.tsx';
import { space } from '../../ui/tokens.ts';
import { useTheme } from '../../ui/theme.tsx';
import { tapFeedback } from '../../ui/haptics.ts';
import { isHexColor } from '../field-hints.ts';
import { asString } from '../form-state.ts';
import type { ControlProps } from './types.ts';

// Colour-swatch data: literal colours are the content here, not theme chrome.
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

const SWATCH = 32;

export function ColorControl({ field, value, onChange, errors }: ControlProps<'color'>): ReactNode {
  const hex = asString(value);
  const { colors } = useTheme();
  const swatches = field.swatches ?? DEFAULT_SWATCHES;
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.swatches}>
        {swatches.map((c) => {
          const on = hex.toLowerCase() === c.toLowerCase();
          return (
            <Press
              key={c}
              accessibilityRole="radio"
              accessibilityLabel={`Colour ${c}`}
              accessibilityState={{ selected: on }}
              testID={`field-${field.key}-${c}`}
              wash={null}
              hitSlop={slop(SWATCH + 6)}
              onPress={() => {
                tapFeedback();
                onChange(c);
              }}
              style={[styles.ring, { borderColor: on ? colors.ink : 'transparent' }]}
            >
              <View style={[styles.swatch, { backgroundColor: c, borderColor: colors.hairline }]} />
            </Press>
          );
        })}
      </View>
      <View style={styles.hexRow}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor: isHexColor(hex) ? hex : colors.surface,
              borderColor: colors.hairline,
            },
          ]}
        />
        <View style={{ width: 140 }}>
          <Field
            dense
            testID={`field-${field.key}`}
            accessibilityLabel={`${field.label} hex`}
            value={hex}
            onChangeText={(t) => onChange(t.startsWith('#') || t === '' ? t : `#${t}`)}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={7}
            placeholder="#rrggbb"
            error={errors.length > 0 ? ' ' : null}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  ring: {
    width: SWATCH + 6,
    height: SWATCH + 6,
    borderRadius: (SWATCH + 6) / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2, borderWidth: 1 },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1 },
});
