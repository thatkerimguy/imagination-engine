import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon } from '../../ui/Icon.tsx';
import { StatePressable } from '../../ui/StateLayer.tsx';
import { TextField } from '../../ui/TextField.tsx';
import { space } from '../../ui/m3-tokens.ts';
import { makeStyles, useTheme } from '../../ui/theme.tsx';
import { tapFeedback } from '../../ui/haptics.ts';
import { isHexColor, readableOn } from '../field-hints.ts';
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

export function ColorControl({ field, value, onChange, errors }: ControlProps<'color'>): ReactNode {
  const hex = asString(value);
  const s = useStyles();
  const { colors } = useTheme();
  const swatches = field.swatches ?? DEFAULT_SWATCHES;
  return (
    <View style={{ gap: space.md }}>
      <View style={s.swatches}>
        {swatches.map((c) => {
          const on = hex.toLowerCase() === c.toLowerCase();
          return (
            <StatePressable
              key={c}
              accessibilityRole="radio"
              accessibilityLabel={`Colour ${c}`}
              accessibilityState={{ selected: on }}
              testID={`field-${field.key}-${c}`}
              layerColor={readableOn(c)}
              onPress={() => {
                tapFeedback();
                onChange(c);
              }}
              style={[
                s.swatch,
                { backgroundColor: c },
                on && { borderWidth: 3, borderColor: colors.primary },
              ]}
            >
              {on ? <Icon name="check" size={24} color={readableOn(c)} /> : null}
            </StatePressable>
          );
        })}
      </View>
      <View style={s.hexRow}>
        <View
          style={[s.dot, { backgroundColor: isHexColor(hex) ? hex : colors.surfaceContainerHigh }]}
        />
        <View style={{ width: 140 }}>
          <TextField
            dense
            testID={`field-${field.key}`}
            accessibilityLabel={`${field.label} hex`}
            value={hex}
            onChangeText={(t) => onChange(t.startsWith('#') || t === '' ? t : `#${t}`)}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={7}
            placeholder="#rrggbb"
            error={errors.length > 0 ? '' : null}
          />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.colors.outlineVariant,
  },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.outlineVariant,
  },
}));
