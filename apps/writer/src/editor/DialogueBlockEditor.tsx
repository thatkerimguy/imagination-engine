// Dialogue: a tracked uppercase speaker name with a 6px colour dot, the serif line beneath.
import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Dot } from '../ui/Page.tsx';
import { useTheme } from '../ui/theme.tsx';
import { type as typeScale } from '../ui/type.ts';
import type { DialogueBlock, InlineEditorProps } from './block-types.ts';
import type { RichEditorExtras } from './ProseBlockEditor.tsx';
import { RichProseInput } from './RichProseInput.tsx';

/** `undefined` = no accent. */
const ACCENTS: readonly (string | undefined)[] = [
  undefined,
  '#e0a458',
  '#4fd1c5',
  '#e26d5a',
  '#8fa8ff',
  '#c792ea',
];

/** The dialogue block with its speaker accent advanced to the next preset. */
export function cycleAccent(block: DialogueBlock): DialogueBlock {
  const next = ACCENTS[(ACCENTS.indexOf(block.accentColor) + 1) % ACCENTS.length];
  const { id, kind, speaker, text, beatStop } = block;
  const base: DialogueBlock = { id, kind, speaker, text, ...(beatStop ? { beatStop } : {}) };
  return next ? { ...base, accentColor: next } : base;
}

export function DialogueBlockEditor(
  p: InlineEditorProps<DialogueBlock> & RichEditorExtras,
): ReactNode {
  const { colors } = useTheme();
  const tint = p.block.accentColor ?? colors.inkSecondary;
  return (
    <View>
      <View style={styles.head}>
        <Dot color={tint} />
        <TextInput
          autoFocus={p.autoFocus}
          value={p.block.speaker}
          onFocus={p.onSelect}
          onChangeText={(speaker) => p.onChange({ ...p.block, speaker })}
          placeholder="SPEAKER"
          placeholderTextColor={colors.inkMuted}
          selectionColor={colors.accent}
          autoCapitalize="characters"
          accessibilityLabel="Speaker"
          style={[typeScale.overline, styles.speaker, { color: tint }]}
        />
      </View>
      <RichProseInput
        text={p.block.text}
        blockStyle={p.blockStyle}
        focused={p.focused}
        placeholder="Line…"
        samsungSafeIme={p.samsungSafeIme}
        selection={p.selection}
        onFocus={p.onSelect}
        onChangeText={(text) => p.onChange({ ...p.block, text })}
        onSelectionChange={p.onSelectionChange}
        testID={`dialogue-text-${p.block.id}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  speaker: { flex: 1, padding: 0, letterSpacing: 1.4 },
});
