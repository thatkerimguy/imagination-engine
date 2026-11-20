import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '../../ui/AppText.tsx';
import { Button } from '../../ui/Button.tsx';
import { IconButton } from '../../ui/IconButton.tsx';
import { TextField } from '../../ui/TextField.tsx';
import { space } from '../../ui/m3-tokens.ts';
import { tapFeedback } from '../../ui/haptics.ts';
import { asStringArray, listAdd, listMove, listRemove, listUpdate } from '../form-state.ts';
import type { ControlProps } from './types.ts';

export function StringListControl({
  field,
  value,
  onChange,
  errors,
}: ControlProps<'string-list'>): ReactNode {
  const items = asStringArray(value);
  const label = field.itemLabel ?? 'Line';
  const canAdd = field.maxItems === undefined || items.length < field.maxItems;
  const canRemove = items.length > (field.minItems ?? 0);
  const act = (fn: () => void) => () => {
    tapFeedback();
    fn();
  };
  return (
    <View style={{ gap: space.md, alignItems: 'flex-start' }}>
      {items.map((item, i) => (
        // Index keys are right here: lines have no identity beyond their position.
        <View key={i} style={{ gap: space.xs, alignSelf: 'stretch' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 32 }}>
            <AppText variant="labelLarge" color="onSurfaceVariant" style={{ flex: 1 }}>
              {`${label} ${i + 1}`}
            </AppText>
            <IconButton
              icon="arrow-upward"
              size={32}
              accessibilityLabel={`Move ${label} ${i + 1} up`}
              disabled={i === 0}
              onPress={act(() => onChange(listMove(items, i, -1)))}
            />
            <IconButton
              icon="arrow-downward"
              size={32}
              accessibilityLabel={`Move ${label} ${i + 1} down`}
              disabled={i === items.length - 1}
              onPress={act(() => onChange(listMove(items, i, 1)))}
            />
            <IconButton
              icon="close"
              size={32}
              accessibilityLabel={`Remove ${label} ${i + 1}`}
              disabled={!canRemove}
              onPress={act(() => onChange(listRemove(items, i, field.minItems)))}
            />
          </View>
          <TextField
            dense
            multiline
            testID={`field-${field.key}-${i}`}
            accessibilityLabel={`${label} ${i + 1}`}
            placeholder={`${label} ${i + 1}`}
            value={item}
            onChangeText={(t) => onChange(listUpdate(items, i, t))}
            error={errors.length > 0 && item.trim() === '' ? '' : null}
          />
        </View>
      ))}
      <Button
        label="Add line"
        variant="tonal"
        icon="add"
        disabled={!canAdd}
        onPress={() => onChange(listAdd(items, '', field.maxItems))}
      />
    </View>
  );
}
