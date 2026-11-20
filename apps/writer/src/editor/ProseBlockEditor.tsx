import type { ReactNode } from 'react';
import type { BlockStyle } from '../store/chapter-styles.ts';
import { useTheme } from '../ui/theme.tsx';
import type { InlineEditorProps, ProseBlock } from './block-types.ts';
import type { Selection } from './inline-edit.ts';
import { RichProseInput } from './RichProseInput.tsx';

export interface RichEditorExtras {
  focused: boolean;
  blockStyle?: BlockStyle;
  samsungSafeIme: boolean;
  selection?: Selection;
  onSelectionChange(sel: Selection): void;
}

export function ProseBlockEditor(p: InlineEditorProps<ProseBlock> & RichEditorExtras): ReactNode {
  const style = p.block.style ?? 'body';
  const { colors } = useTheme();
  return (
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
      baseStyle={[
        style === 'whisper' && { fontStyle: 'italic', color: colors.inkSecondary },
        style === 'emphasis' && { fontWeight: '700' },
      ]}
    />
  );
}
