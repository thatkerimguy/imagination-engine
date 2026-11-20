import type { ReactNode } from 'react';
import { View } from 'react-native';
import { GrowingTextInput } from '../ui/GrowingTextInput.tsx';
import { proseFont, space } from '../ui/m3-tokens.ts';
import { SegmentedButtons } from '../ui/SegmentedButtons.tsx';
import { makeStyles, useTheme } from '../ui/theme.tsx';
import type { InlineEditorProps, ProseBlock } from './block-types.ts';

type ProseStyle = NonNullable<ProseBlock['style']>;

const SEGMENTS: readonly { value: ProseStyle; label: string }[] = [
  { value: 'body', label: 'Body' },
  { value: 'whisper', label: 'Whisper' },
  { value: 'emphasis', label: 'Emphasis' },
];

const useStyles = makeStyles((t) => ({
  wrap: { gap: space.sm },
  input: {
    color: t.colors.onSurface,
    fontFamily: proseFont,
    fontSize: 17,
    lineHeight: 26,
    padding: 0,
    minHeight: 26,
  },
  whisper: { fontStyle: 'italic', color: t.colors.onSurfaceVariant },
  emphasis: { fontWeight: '700' },
}));

export function ProseBlockEditor(p: InlineEditorProps<ProseBlock>): ReactNode {
  const style = p.block.style ?? 'body';
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.wrap}>
      <GrowingTextInput
        autoFocus={p.autoFocus}
        value={p.block.text}
        onFocus={p.onSelect}
        onChangeText={(text) => p.onChange({ ...p.block, text })}
        placeholder="Write…"
        placeholderTextColor={colors.onSurfaceVariant}
        textAlignVertical="top"
        style={[s.input, style === 'whisper' && s.whisper, style === 'emphasis' && s.emphasis]}
      />
    </View>
  );
}

/** Style picker; rendered by the action area of a selected prose block. */
export function ProseStyleControl(p: {
  block: ProseBlock;
  onChange(next: ProseBlock): void;
}): ReactNode {
  return (
    <SegmentedButtons
      segments={SEGMENTS}
      value={p.block.style ?? 'body'}
      onChange={(style) => p.onChange({ ...p.block, style })}
      accessibilityLabel="Prose style"
      testID={`prose-style-${p.block.id}`}
    />
  );
}
