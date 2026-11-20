import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '../../ui/AppText.tsx';
import { space } from '../../ui/m3-tokens.ts';
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
    <View style={{ gap: space.xs }}>
      <NumberStepper
        testID={`field-${field.key}`}
        value={asNumber(value, field.min)}
        min={field.min}
        max={field.max}
        step={field.step}
        label={field.label}
        invalid={errors.length > 0}
        onChange={onChange}
      />
      <AppText variant="bodySmall" color="onSurfaceVariant">
        {rangeHint(field)}
      </AppText>
    </View>
  );
}
