import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Field } from '../ui/Field.tsx';
import { space } from '../ui/tokens.ts';

/** Inline text edit with Save / Cancel, used for season and chapter titles. */
export function InlineRename({
  initial,
  label,
  testID,
  onSave,
  onCancel,
}: {
  initial: string;
  label: string;
  testID: string;
  onSave(title: string): void;
  onCancel(): void;
}): ReactNode {
  const [value, setValue] = useState(initial);
  return (
    <View style={styles.wrap}>
      <Field label={label} value={value} onChangeText={setValue} autoFocus serif testID={testID} />
      <View style={styles.row}>
        <ActionButton label="Cancel" variant="ghost" quiet compact onPress={onCancel} />
        <ActionButton
          label="Save"
          variant="ghost"
          compact
          disabled={!value.trim()}
          onPress={() => onSave(value)}
          testID={`${testID}-save`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, flex: 1, paddingVertical: space.xs },
  row: { flexDirection: 'row', gap: space.xs, justifyContent: 'flex-end' },
});
