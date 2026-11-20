import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../ui/Button.tsx';
import { colors, radius, space } from '../../ui/theme.ts';
import { asNumberArray, listAdd, listRemove, listUpdate } from '../form-state.ts';
import { NumberStepper } from './NumberStepper.tsx';
import { controlStyles as s } from './styles.ts';
import type { ControlProps } from './types.ts';

export function NumberListControl({
  field,
  value,
  onChange,
}: ControlProps<'number-list'>): ReactNode {
  const items = asNumberArray(value);
  const canAdd = field.maxItems === undefined || items.length < field.maxItems;
  const canRemove = items.length > (field.minItems ?? 0);
  return (
    <View style={s.stack}>
      <View style={styles.wrap}>
        {items.map((n, i) => (
          <View key={i} style={styles.chip}>
            <NumberStepper
              value={n}
              min={field.min}
              max={field.max}
              step={field.step}
              label={`${field.label} ${i + 1}`}
              onChange={(v) => onChange(listUpdate(items, i, v))}
            />
            <Button
              label="✕"
              accessibilityLabel={`Remove ${field.label} ${i + 1}`}
              variant="ghost"
              compact
              disabled={!canRemove}
              onPress={() => onChange(listRemove(items, i, field.minItems))}
            />
          </View>
        ))}
      </View>
      <Button
        label="+ Add"
        compact
        disabled={!canAdd}
        onPress={() => onChange(listAdd(items, field.min, field.maxItems))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingLeft: space.xs,
    backgroundColor: colors.surface,
  },
});
