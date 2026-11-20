import type { ReactNode } from 'react';
import { View } from 'react-native';
import { rangeHint } from '../field-hints.ts';
import { asNumber } from '../form-state.ts';
import { NumberStepper } from './NumberStepper.tsx';
import type { ControlProps } from './types.ts';

export function NumberControl({
  field,
  value,
  onChange,
  errors,
}: ControlProps<'number'>): ReactNode {
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <NumberStepper
        testID={`field-${field.key}`}
        value={asNumber(value, field.min)}
        min={field.min}
        max={field.max}
        step={field.step}
        label={field.label}
        caption={rangeHint(field)}
        invalid={errors.length > 0}
        onChange={onChange}
      />
    </View>
  );
}
