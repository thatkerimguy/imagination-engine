// Controls for the simple blueprint field types: text, multiline, select, number, boolean, color.
import type { BlueprintFieldSpec } from '@kn/core/gimmicks';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { OptionGrid } from '../forms/controls/OptionGrid.tsx';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { Field } from '../ui/Field.tsx';
import { Press } from '../ui/Press.tsx';
import { SegmentControl } from '../ui/SegmentControl.tsx';
import { Stepper } from '../ui/Stepper.tsx';
import { Toggle } from '../ui/Toggle.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { numberOf, textOf } from './form-model.ts';

export interface ControlProps<F extends BlueprintFieldSpec> {
  field: F;
  value: unknown;
  invalid: boolean;
  onChange(v: string | number | boolean): void;
}
type Of<T extends BlueprintFieldSpec['type']> = Extract<BlueprintFieldSpec, { type: T }>;

export const TextField = ({
  field,
  value,
  invalid,
  onChange,
}: ControlProps<Of<'text' | 'multiline'>>): ReactNode => (
  <Field
    testID={`field-${field.key}`}
    accessibilityLabel={field.label}
    value={textOf(value)}
    onChangeText={onChange}
    placeholder={field.placeholder}
    multiline={field.type === 'multiline'}
    maxLength={field.maxLength}
    error={invalid ? ' ' : null}
    trailingHint={
      field.maxLength !== undefined ? `${textOf(value).length}/${field.maxLength}` : undefined
    }
  />
);

export function SelectField({ field, value, onChange }: ControlProps<Of<'select'>>): ReactNode {
  const cur = textOf(value);
  const short = field.options.length <= 3 && field.options.every((o) => o.label.length <= 10);
  if (short)
    return (
      <SegmentControl
        accessibilityLabel={field.label}
        value={cur}
        onChange={onChange}
        options={field.options.map((o) => ({
          value: o.value,
          label: o.label,
          testID: `field-${field.key}-${o.value}`,
        }))}
      />
    );
  return (
    <OptionGrid
      role="radio"
      options={field.options}
      isSelected={(v) => v === cur}
      onPick={onChange}
      testIDFor={(v) => `field-${field.key}-${v}`}
    />
  );
}

export function NumberField({
  field,
  value,
  invalid,
  onChange,
}: ControlProps<Of<'number'>>): ReactNode {
  const { t } = useI18n();
  const range = t('form.range', { min: field.min, max: field.max });
  return (
    <View style={styles.start}>
      <Stepper
        testID={`field-${field.key}`}
        label={field.label}
        value={numberOf(value, field.min)}
        min={field.min}
        max={field.max}
        step={field.step}
        invalid={invalid}
        caption={field.unit ? `${range} ${field.unit}` : range}
        onChange={onChange}
      />
    </View>
  );
}

export function BooleanField({ field, value, onChange }: ControlProps<Of<'boolean'>>): ReactNode {
  return (
    <View style={styles.bool}>
      <Txt variant="label" style={styles.grow}>
        {field.label}
      </Txt>
      <Toggle
        testID={`field-${field.key}`}
        accessibilityLabel={field.label}
        value={value === true}
        onValueChange={onChange}
      />
    </View>
  );
}

// Literal colours are content here, not chrome.
const SWATCHES = [
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

export function ColorField({
  field,
  value,
  invalid,
  onChange,
}: ControlProps<Of<'color'>>): ReactNode {
  const { t } = useI18n();
  const { colors } = useTheme();
  const hex = textOf(value);
  const ok = /^#[0-9a-f]{6}$/i.test(hex);
  return (
    <View style={styles.colors}>
      <View style={styles.swatches}>
        {SWATCHES.map((c) => (
          <Press
            key={c}
            accessibilityRole="radio"
            accessibilityLabel={t('form.colorSwatch', { hex: c })}
            accessibilityState={{ selected: hex.toLowerCase() === c }}
            testID={`field-${field.key}-${c}`}
            wash={null}
            hitSlop={8}
            onPress={() => onChange(c)}
            style={[
              styles.ring,
              { borderColor: hex.toLowerCase() === c ? colors.ink : 'transparent' },
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: c, borderColor: colors.hairline }]} />
          </Press>
        ))}
      </View>
      <View style={styles.hexRow}>
        <View
          style={[
            styles.dot,
            { backgroundColor: ok ? hex : colors.surface, borderColor: colors.hairline },
          ]}
        />
        <View style={styles.hex}>
          <Field
            dense
            testID={`field-${field.key}`}
            accessibilityLabel={t('form.colorHex', { label: field.label })}
            value={hex}
            onChangeText={(x) => onChange(x.startsWith('#') || x === '' ? x : `#${x}`)}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={7}
            placeholder="#rrggbb"
            error={invalid ? ' ' : null}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  start: { alignItems: 'flex-start' },
  bool: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  grow: { flex: 1, flexShrink: 1 },
  colors: { gap: space.sm },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  ring: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1 },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1 },
  hex: { width: 140 },
});
