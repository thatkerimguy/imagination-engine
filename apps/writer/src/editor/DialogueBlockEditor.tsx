import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GrowingTextInput } from '../ui/GrowingTextInput.tsx';
import { tapFeedback } from '../ui/haptics.ts';
import { colors, fonts, space } from '../ui/legacy-theme.ts';
import type { DialogueBlock, InlineEditorProps } from './block-types.ts';

/** `undefined` = no accent. */
const ACCENTS: readonly (string | undefined)[] = [
  undefined,
  '#e0a458',
  '#4fd1c5',
  '#e26d5a',
  '#8fa8ff',
  '#c792ea',
];

export function DialogueBlockEditor(p: InlineEditorProps<DialogueBlock>): ReactNode {
  const accent = p.block.accentColor;
  const tint = accent ?? colors.muted;
  const cycle = (): void => {
    tapFeedback();
    const at = ACCENTS.indexOf(accent);
    const next = ACCENTS[(at + 1) % ACCENTS.length];
    const { id, kind, speaker, text, beatStop } = p.block;
    const base: DialogueBlock = { id, kind, speaker, text, ...(beatStop ? { beatStop } : {}) };
    p.onChange(next ? { ...base, accentColor: next } : base);
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable
          onPress={cycle}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cycle accent colour"
          testID={`accent-${p.block.id}`}
        >
          <Text style={[styles.dot, { color: tint }]}>{accent ? '●' : '○'}</Text>
        </Pressable>
        <TextInput
          autoFocus={p.autoFocus}
          value={p.block.speaker}
          onFocus={p.onSelect}
          onChangeText={(speaker) => p.onChange({ ...p.block, speaker })}
          placeholder="SPEAKER"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          style={[styles.speaker, { color: tint }]}
        />
      </View>
      <GrowingTextInput
        scrollEnabled={false}
        value={p.block.text}
        onFocus={p.onSelect}
        onChangeText={(text) => p.onChange({ ...p.block, text })}
        placeholder="Line…"
        placeholderTextColor={colors.muted}
        textAlignVertical="top"
        style={styles.line}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { fontSize: 18 },
  speaker: { flex: 1, fontSize: 13, fontWeight: '700', letterSpacing: 1.4, padding: 0 },
  line: {
    color: colors.fg,
    fontFamily: fonts.prose,
    fontSize: 17,
    lineHeight: 26,
    padding: 0,
    minHeight: 26,
  },
});
