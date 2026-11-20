import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/TextField.tsx';
import { space } from '../ui/theme.ts';

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
      <TextField label={label} value={value} onChangeText={setValue} autoFocus testID={testID} />
      <View style={styles.row}>
        <Button
          label="Save"
          variant="primary"
          compact
          disabled={!value.trim()}
          onPress={() => onSave(value)}
          testID={`${testID}-save`}
        />
        <Button label="Cancel" variant="ghost" compact onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
});
