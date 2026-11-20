import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ActionButton } from '../../ui/ActionButton.tsx';
import { IconBtn } from '../../ui/IconBtn.tsx';
import { Txt } from '../../ui/Txt.tsx';
import { space } from '../../ui/tokens.ts';
import { rangeHint } from '../field-hints.ts';
import { asNumberArray, listAdd, listRemove, listUpdate } from '../form-state.ts';
import { NumberStepper } from './NumberStepper.tsx';
import type { ControlProps } from './types.ts';

export function NumberListControl({
  field,
  value,
  onChange,
  errors,
}: ControlProps<'number-list'>): ReactNode {
  const items = asNumberArray(value);
  const canAdd = field.maxItems === undefined || items.length < field.maxItems;
  const canRemove = items.length > (field.minItems ?? 0);
  return (
    <View style={{ gap: space.sm }}>
      {items.map((n, i) => (
        // Index keys: items have no identity beyond their position.
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <NumberStepper
            compact
            testID={`field-${field.key}-${i}`}
            value={n}
            min={field.min}
            max={field.max}
            step={field.step}
            label={`${field.label} ${i + 1}`}
            invalid={errors.length > 0}
            onChange={(v) => onChange(listUpdate(items, i, v))}
          />
          <IconBtn
            icon="x"
            box={32}
            size={16}
            accessibilityLabel={`Remove ${field.label} ${i + 1}`}
            disabled={!canRemove}
            onPress={() => onChange(listRemove(items, i, field.minItems))}
          />
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <ActionButton
          label="Add"
          variant="secondary"
          compact
          icon="plus"
          disabled={!canAdd}
          onPress={() => onChange(listAdd(items, field.min, field.maxItems))}
        />
        <Txt variant="caption" color="inkMuted">
          {rangeHint(field)} each
        </Txt>
      </View>
    </View>
  );
}
