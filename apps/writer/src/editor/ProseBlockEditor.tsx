import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GrowingTextInput } from '../ui/GrowingTextInput.tsx';
import { Chip } from '../ui/Chip';
import { colors, fonts, space } from '../ui/legacy-theme.ts';
import type { InlineEditorProps, ProseBlock } from './block-types.ts';

const STYLES = ['body', 'whisper', 'emphasis'] as const;

export function ProseBlockEditor(p: InlineEditorProps<ProseBlock>): ReactNode {
  const style = p.block.style ?? 'body';
  return (
    <View style={styles.wrap}>
      <GrowingTextInput
        autoFocus={p.autoFocus}
        value={p.block.text}
        onFocus={p.onSelect}
        onChangeText={(text) => p.onChange({ ...p.block, text })}
        placeholder="Write…"
        placeholderTextColor={colors.muted}
        textAlignVertical="top"
        style={[
          styles.input,
          style === 'whisper' && styles.whisper,
          style === 'emphasis' && styles.emphasis,
        ]}
      />
    </View>
  );
}

/** Style chips; rendered by the action area of a selected prose block. */
export function ProseStyleChips(p: {
  block: ProseBlock;
  onChange(next: ProseBlock): void;
}): ReactNode {
  const current = p.block.style ?? 'body';
  return (
    <View style={styles.chips}>
      {STYLES.map((s) => (
        <Chip
          key={s}
          label={s}
          selected={current === s}
          onPress={() => p.onChange({ ...p.block, style: s })}
          testID={`prose-style-${s}-${p.block.id}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  input: {
    color: colors.fg,
    fontFamily: fonts.prose,
    fontSize: 17,
    lineHeight: 26,
    padding: 0,
    minHeight: 26,
  },
  whisper: { fontStyle: 'italic', color: colors.muted },
  emphasis: { fontWeight: '700' },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
