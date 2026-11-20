import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, space } from '../ui/theme.ts';
import type { InlineEditorProps, SceneBreakBlock } from './block-types.ts';

export function SceneBreakEditor(p: InlineEditorProps<SceneBreakBlock>): ReactNode {
  return (
    <View style={styles.wrap}>
      <Text style={styles.mark}>◆</Text>
      <TextInput
        value={p.block.label ?? ''}
        onFocus={p.onSelect}
        onChangeText={(label) => p.onChange({ ...p.block, label })}
        placeholder="Label (optional)"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <TextInput
        value={p.block.timestamp ?? ''}
        onFocus={p.onSelect}
        onChangeText={(timestamp) => p.onChange({ ...p.block, timestamp })}
        placeholder="Timestamp (optional)"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xs, paddingVertical: space.sm },
  mark: { color: colors.accent, fontSize: 18 },
  input: { color: colors.muted, fontSize: 13, textAlign: 'center', padding: 0, minWidth: 160 },
});
