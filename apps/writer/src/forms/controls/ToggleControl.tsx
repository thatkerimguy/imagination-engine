import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Toggle } from '../../ui/Toggle.tsx';
import { Txt } from '../../ui/Txt.tsx';
import { space } from '../../ui/tokens.ts';
import type { ControlProps } from './types.ts';

/** Label (and help) on the left, toggle on the right. SchemaForm skips its own chrome for this. */
export function ToggleControl({ field, value, onChange }: ControlProps<'toggle'>): ReactNode {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, minHeight: 48 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="label">{field.label}</Txt>
        {field.help ? (
          <Txt variant="caption" color="inkMuted">
            {field.help}
          </Txt>
        ) : null}
      </View>
      <Toggle
        testID={`field-${field.key}`}
        accessibilityLabel={field.label}
        value={value === true}
        onValueChange={onChange}
      />
    </View>
  );
}
