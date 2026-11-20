// Folio stepper: one hairline capsule [ − | value | + ] with an editable tabular centre and an
// optional muted range caption underneath. Typed values snap to the step and commit on blur.
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Glyph } from './Glyph.tsx';
import { tapFeedback } from './haptics.ts';
import { Press } from './Press.tsx';
import { Txt } from './Txt.tsx';
import { radius, TOUCH } from './tokens.ts';
import { useTheme } from './theme.tsx';
import { tabular, type as typeScale } from './type.ts';

export interface StepperProps {
  value: number;
  min: number;
  max: number;
  step: number;
  /** Used for accessibility labels ("Increase {label}"). */
  label: string;
  onChange(value: number): void;
  /** Muted caption under the capsule (e.g. "8 – 40"). */
  caption?: string;
  /** Formats the displayed value (e.g. `1.5×`); typing still edits the raw number. */
  format?(value: number): string;
  compact?: boolean;
  invalid?: boolean;
  testID?: string;
}

const decimals = (step: number): number => (String(step).split('.')[1] ?? '').length;

/** Clamps to [min, max] and snaps to the nearest step from `min`. */
export function snapToStep(v: number, min: number, max: number, step: number): number {
  const snapped = step > 0 ? min + Math.round((v - min) / step) * step : v;
  return Number(Math.min(max, Math.max(min, snapped)).toFixed(decimals(step)));
}

export function Stepper(p: StepperProps): ReactNode {
  const { colors } = useTheme();
  const { format, value } = p;
  const shown = (v: number): string => (format ? format(v) : String(v));
  const [text, setText] = useState(shown(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(format ? format(value) : String(value));
  }, [value, format, editing]);
  const h = p.compact ? 36 : TOUCH;
  const commit = (): void => {
    setEditing(false);
    const n = Number(text.replace(',', '.').replace(/[^\d.-]/g, ''));
    if (text.trim() === '' || !Number.isFinite(n)) return setText(shown(p.value));
    const next = snapToStep(n, p.min, p.max, p.step);
    setText(shown(next));
    if (next !== p.value) p.onChange(next);
  };
  const go = (dir: 1 | -1): void => {
    tapFeedback();
    p.onChange(snapToStep(p.value + dir * p.step, p.min, p.max, p.step));
  };
  const border = p.invalid ? colors.danger : colors.hairline;
  const btn = (dir: 1 | -1): ReactNode => (
    <Press
      accessibilityRole="button"
      accessibilityLabel={`${dir < 0 ? 'Decrease' : 'Increase'} ${p.label}`}
      disabled={dir < 0 ? p.value <= p.min : p.value >= p.max}
      onPress={() => go(dir)}
      hitSlop={p.compact ? { top: 4, bottom: 4 } : undefined}
      style={[styles.btn, { height: h - 2 }]}
    >
      <Glyph name={dir < 0 ? 'minus' : 'plus'} size={16} color="ink" />
    </Press>
  );
  return (
    <View style={styles.wrap}>
      <View style={[styles.capsule, { height: h, borderColor: border }]}>
        {btn(-1)}
        <View style={[styles.sep, { backgroundColor: colors.hairline }]} />
        <TextInput
          testID={p.testID}
          accessibilityLabel={`${p.label} value`}
          value={text}
          onChangeText={setText}
          onFocus={() => {
            setEditing(true);
            setText(String(p.value));
          }}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          selectionColor={colors.accent}
          style={[typeScale.bodyStrong, tabular, styles.input, { color: colors.ink }]}
        />
        <View style={[styles.sep, { backgroundColor: colors.hairline }]} />
        {btn(1)}
      </View>
      {p.caption ? (
        <Txt variant="caption" color="inkMuted" style={styles.caption}>
          {p.caption}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  btn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  sep: { width: 1, alignSelf: 'stretch' },
  input: { width: 64, textAlign: 'center', paddingVertical: 0, paddingHorizontal: 4 },
  caption: { textAlign: 'center' },
});
