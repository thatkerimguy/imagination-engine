import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../ui/Button.tsx';
import { space } from '../ui/m3-tokens.ts';
import { TextField } from '../ui/TextField.tsx';

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
        <Button label="Cancel" variant="text" onPress={onCancel} />
        <Button
          label="Save"
          variant="text"
          disabled={!value.trim()}
          onPress={() => onSave(value)}
          testID={`${testID}-save`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, flex: 1 },
  row: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' },
});
