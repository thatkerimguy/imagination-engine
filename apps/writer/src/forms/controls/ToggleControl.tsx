import type { ReactNode } from 'react';
import { Switch, View } from 'react-native';
import { colors } from '../../ui/legacy-theme.ts';
import { toggleFeedback } from '../../ui/haptics.ts';
import type { ControlProps } from './types.ts';

export function ToggleControl({ field, value, onChange }: ControlProps<'toggle'>): ReactNode {
  return (
    <View style={{ minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' }}>
      <Switch
        testID={`field-${field.key}`}
        accessibilityLabel={field.label}
        value={value === true}
        onValueChange={(on) => {
          toggleFeedback(on);
          onChange(on);
        }}
        trackColor={{ false: colors.line, true: colors.accent }}
        thumbColor={colors.fg}
      />
    </View>
  );
}
