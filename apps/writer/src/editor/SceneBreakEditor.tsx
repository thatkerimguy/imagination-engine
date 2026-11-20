// Scene break: an airy centred ornament `— ◆ Label · Timestamp —`; tapping it expands two
// borderless inline inputs (Label, Timestamp).
import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Txt } from '../ui/Txt.tsx';
import { useTheme } from '../ui/theme.tsx';
import { type as typeScale } from '../ui/type.ts';
import type { InlineEditorProps, SceneBreakBlock } from './block-types.ts';

export function SceneBreakEditor(
  p: InlineEditorProps<SceneBreakBlock> & { expanded: boolean },
): ReactNode {
  const { colors } = useTheme();
  const caption = [p.block.label, p.block.timestamp].filter(Boolean).join(' · ');
  const input = [typeScale.label, styles.input, { color: colors.ink }];
  return (
    <View style={styles.wrap}>
      <Txt
        variant="label"
        color="inkMuted"
        style={styles.caption}
        testID={`scene-caption-${p.block.id}`}
      >
        {caption ? `—  ◆  ${caption}  —` : '—  ◆  —'}
      </Txt>
      {p.expanded ? (
        <>
          <TextInput
            value={p.block.label ?? ''}
            onFocus={p.onSelect}
            onChangeText={(label) => p.onChange({ ...p.block, label })}
            placeholder="Label"
            accessibilityLabel="Label"
            placeholderTextColor={colors.inkMuted}
            selectionColor={colors.accent}
            style={input}
          />
          <TextInput
            value={p.block.timestamp ?? ''}
            onFocus={p.onSelect}
            onChangeText={(timestamp) => p.onChange({ ...p.block, timestamp })}
            placeholder="Timestamp"
            accessibilityLabel="Timestamp"
            placeholderTextColor={colors.inkMuted}
            selectionColor={colors.accent}
            style={input}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 20, alignItems: 'stretch', gap: 2 },
  caption: { textAlign: 'center', letterSpacing: 0.6 },
  input: { textAlign: 'center', minHeight: 40, padding: 0 },
});
