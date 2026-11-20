import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { BlockStyle } from '../store/chapter-styles.ts';
import { space } from '../ui/m3-tokens.ts';
import { SegmentedButtons } from '../ui/SegmentedButtons.tsx';
import { makeStyles } from '../ui/theme.tsx';
import type { InlineEditorProps, ProseBlock } from './block-types.ts';
import type { Selection } from './inline-edit.ts';
import { RichProseInput } from './RichProseInput.tsx';

type ProseStyle = NonNullable<ProseBlock['style']>;

const SEGMENTS: readonly { value: ProseStyle; label: string }[] = [
  { value: 'body', label: 'Body' },
  { value: 'whisper', label: 'Whisper' },
  { value: 'emphasis', label: 'Emphasis' },
];

export interface RichEditorExtras {
  focused: boolean;
  blockStyle?: BlockStyle;
  samsungSafeIme: boolean;
  selection?: Selection;
  onSelectionChange(sel: Selection): void;
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: space.sm },
  whisper: { fontStyle: 'italic', color: t.m3.onSurfaceVariant },
  emphasis: { fontWeight: '700' },
}));

export function ProseBlockEditor(p: InlineEditorProps<ProseBlock> & RichEditorExtras): ReactNode {
  const style = p.block.style ?? 'body';
  const s = useStyles();
  return (
    <View style={s.wrap}>
      <RichProseInput
        text={p.block.text}
        blockStyle={p.blockStyle}
        focused={p.focused}
        autoFocus={p.autoFocus}
        placeholder="Write…"
        samsungSafeIme={p.samsungSafeIme}
        selection={p.selection}
        onFocus={p.onSelect}
        onChangeText={(text) => p.onChange({ ...p.block, text })}
        onSelectionChange={p.onSelectionChange}
        testID={`prose-text-${p.block.id}`}
        baseStyle={[style === 'whisper' && s.whisper, style === 'emphasis' && s.emphasis]}
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
