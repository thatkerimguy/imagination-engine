import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../ui/Button.tsx';
import { colors, space } from '../../ui/legacy-theme.ts';
import { tapFeedback } from '../../ui/haptics.ts';
import { asStringArray, listAdd, listMove, listRemove, listUpdate } from '../form-state.ts';
import { controlStyles as s } from './styles.ts';
import type { ControlProps } from './types.ts';

function IconBtn(p: {
  glyph: string;
  label: string;
  disabled?: boolean;
  onPress(): void;
}): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.label}
      disabled={p.disabled}
      onPress={() => {
        tapFeedback();
        p.onPress();
      }}
      style={[s.roundBtn, styles.small, p.disabled && s.disabled]}
    >
      <Text style={s.roundBtnText}>{p.glyph}</Text>
    </Pressable>
  );
}

export function StringListControl({
  field,
  value,
  onChange,
  errors,
}: ControlProps<'string-list'>): ReactNode {
  const items = asStringArray(value);
  const label = field.itemLabel ?? 'Item';
  const canAdd = field.maxItems === undefined || items.length < field.maxItems;
  const canRemove = items.length > (field.minItems ?? 0);
  return (
    <View style={s.stack}>
      {items.map((item, i) => (
        // Index keys are right here: lines have no identity beyond their position.
        <View key={i} style={styles.line}>
          <TextInput
            testID={`field-${field.key}-${i}`}
            accessibilityLabel={`${label} ${i + 1}`}
            placeholder={`${label} ${i + 1}`}
            placeholderTextColor={colors.muted}
            value={item}
            onChangeText={(t) => onChange(listUpdate(items, i, t))}
            multiline
            style={[s.input, styles.input, errors.length > 0 && item.trim() === '' && s.invalid]}
          />
          <View style={styles.actions}>
            <IconBtn
              glyph="↑"
              label={`Move ${label} ${i + 1} up`}
              disabled={i === 0}
              onPress={() => onChange(listMove(items, i, -1))}
            />
            <IconBtn
              glyph="↓"
              label={`Move ${label} ${i + 1} down`}
              disabled={i === items.length - 1}
              onPress={() => onChange(listMove(items, i, 1))}
            />
            <IconBtn
              glyph="✕"
              label={`Remove ${label} ${i + 1}`}
              disabled={!canRemove}
              onPress={() => onChange(listRemove(items, i, field.minItems))}
            />
          </View>
        </View>
      ))}
      <Button
        label="+ Add line"
        compact
        disabled={!canAdd}
        onPress={() => onChange(listAdd(items, '', field.maxItems))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  line: { gap: space.xs },
  input: { minHeight: 44 },
  actions: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' },
  small: { width: 44, height: 36, borderRadius: 10 },
});
