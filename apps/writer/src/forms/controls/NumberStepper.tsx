import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space, TAP } from '../../ui/theme.ts';
import { tapFeedback } from '../../ui/haptics.ts';
import { stepNumber } from '../form-state.ts';
import { controlStyles as s } from './styles.ts';

export interface NumberStepperProps {
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  label: string;
  onChange(value: number): void;
}

/** − value + buttons; the value text is shown between them. */
export function NumberStepper(p: NumberStepperProps): ReactNode {
  const go = (dir: 1 | -1): void => {
    tapFeedback();
    p.onChange(stepNumber(p.value, dir, p.min, p.max, p.step));
  };
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${p.label}`}
        disabled={p.value <= p.min}
        onPress={() => go(-1)}
        style={[s.roundBtn, p.value <= p.min && s.disabled]}
      >
        <Text style={s.roundBtnText}>−</Text>
      </Pressable>
      <Text style={styles.value}>
        {p.value}
        {p.unit ? ` ${p.unit}` : ''}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${p.label}`}
        disabled={p.value >= p.max}
        onPress={() => go(1)}
        style={[s.roundBtn, p.value >= p.max && s.disabled]}
      >
        <Text style={s.roundBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  value: {
    minWidth: TAP + 8,
    textAlign: 'center',
    color: colors.fg,
    fontSize: 16,
    fontWeight: '600',
  },
});
