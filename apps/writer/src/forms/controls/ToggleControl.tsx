import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '../../ui/AppText.tsx';
import { Switch } from '../../ui/Switch.tsx';
import { space } from '../../ui/m3-tokens.ts';
import { toggleFeedback } from '../../ui/haptics.ts';
import type { ControlProps } from './types.ts';

/** Label (and help) on the left, switch on the right. SchemaForm skips its own chrome for this. */
export function ToggleControl({ field, value, onChange }: ControlProps<'toggle'>): ReactNode {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, minHeight: 48 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="titleSmall">{field.label}</AppText>
        {field.help ? (
          <AppText variant="bodySmall" color="onSurfaceVariant">
            {field.help}
          </AppText>
        ) : null}
      </View>
      <Switch
        testID={`field-${field.key}`}
        accessibilityLabel={field.label}
        value={value === true}
        onValueChange={(on) => {
          toggleFeedback(on);
          onChange(on);
        }}
      />
    </View>
  );
}
