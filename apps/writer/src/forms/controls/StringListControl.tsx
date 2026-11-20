import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ActionButton } from '../../ui/ActionButton.tsx';
import { Field } from '../../ui/Field.tsx';
import { IconBtn } from '../../ui/IconBtn.tsx';
import { Txt } from '../../ui/Txt.tsx';
import { space } from '../../ui/tokens.ts';
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
        <View key={i} style={{ gap: space.xxs, alignSelf: 'stretch' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 32 }}>
            <Txt variant="overline" color="inkMuted" style={{ flex: 1 }}>
              {`${label} ${i + 1}`}
            </Txt>
            <IconBtn
              icon="arrow-up"
              box={32}
              size={16}
              accessibilityLabel={`Move ${label} ${i + 1} up`}
              disabled={i === 0}
              onPress={act(() => onChange(listMove(items, i, -1)))}
            />
            <IconBtn
              icon="arrow-down"
              box={32}
              size={16}
              accessibilityLabel={`Move ${label} ${i + 1} down`}
              disabled={i === items.length - 1}
              onPress={act(() => onChange(listMove(items, i, 1)))}
            />
            <IconBtn
              icon="x"
              box={32}
              size={16}
              accessibilityLabel={`Remove ${label} ${i + 1}`}
              disabled={!canRemove}
              onPress={act(() => onChange(listRemove(items, i, field.minItems)))}
            />
          </View>
          <Field
            dense
            multiline
            testID={`field-${field.key}-${i}`}
            accessibilityLabel={`${label} ${i + 1}`}
            placeholder={`${label} ${i + 1}`}
            value={item}
            onChangeText={(t) => onChange(listUpdate(items, i, t))}
            error={errors.length > 0 && item.trim() === '' ? ' ' : null}
          />
        </View>
      ))}
      <ActionButton
        label="Add line"
        variant="secondary"
        compact
        icon="plus"
        disabled={!canAdd}
        onPress={() => onChange(listAdd(items, '', field.maxItems))}
      />
    </View>
  );
}
