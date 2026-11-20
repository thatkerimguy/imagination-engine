import type { ReactNode } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { GrowingTextInput } from '../ui/GrowingTextInput.tsx';
import { tapFeedback } from '../ui/haptics.ts';
import { proseFont, space, TOUCH } from '../ui/m3-tokens.ts';
import { makeStyles, useTheme } from '../ui/theme.tsx';
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

const useStyles = makeStyles((t) => ({
  wrap: { gap: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  target: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8 },
  speaker: { flex: 1, fontSize: 13, fontWeight: '700', letterSpacing: 1.4, padding: 0 },
  line: {
    color: t.colors.onSurface,
    fontFamily: proseFont,
    fontSize: 17,
    lineHeight: 26,
    padding: 0,
    minHeight: 26,
  },
}));

export function DialogueBlockEditor(p: InlineEditorProps<DialogueBlock>): ReactNode {
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
      <GrowingTextInput
        scrollEnabled={false}
        value={p.block.text}
        onFocus={p.onSelect}
        onChangeText={(text) => p.onChange({ ...p.block, text })}
        placeholder="Line…"
        placeholderTextColor={colors.onSurfaceVariant}
        textAlignVertical="top"
        style={s.line}
      />
    </View>
  );
}
