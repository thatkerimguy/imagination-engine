import type { ReactNode } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { tapFeedback } from '../ui/haptics.ts';
import { space, TOUCH } from '../ui/m3-tokens.ts';
import { makeStyles, useTheme } from '../ui/theme.tsx';
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

const useStyles = makeStyles(() => ({
  wrap: { gap: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  target: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8 },
  speaker: { flex: 1, fontSize: 13, fontWeight: '700', letterSpacing: 1.4, padding: 0 },
}));

export function DialogueBlockEditor(
  p: InlineEditorProps<DialogueBlock> & RichEditorExtras,
): ReactNode {
  const accent = p.block.accentColor;
  const { colors } = useTheme();
  const s = useStyles();
  const tint = accent ?? colors.onSurfaceVariant;
  const cycle = (): void => {
    tapFeedback();
    const at = ACCENTS.indexOf(accent);
    const next = ACCENTS[(at + 1) % ACCENTS.length];
    const { id, kind, speaker, text, beatStop } = p.block;
    const base: DialogueBlock = { id, kind, speaker, text, ...(beatStop ? { beatStop } : {}) };
    p.onChange(next ? { ...base, accentColor: next } : base);
  };
  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Pressable
          onPress={cycle}
          accessibilityRole="button"
          accessibilityLabel="Cycle accent colour"
          testID={`accent-${p.block.id}`}
          style={s.target}
        >
          <View
            style={[
              s.dot,
              accent
                ? { backgroundColor: accent }
                : { borderWidth: 2, borderColor: colors.onSurfaceVariant },
            ]}
          />
        </Pressable>
        <TextInput
          autoFocus={p.autoFocus}
          value={p.block.speaker}
          onFocus={p.onSelect}
          onChangeText={(speaker) => p.onChange({ ...p.block, speaker })}
          placeholder="SPEAKER"
          placeholderTextColor={colors.onSurfaceVariant}
          autoCapitalize="characters"
          style={[s.speaker, { color: tint }]}
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
