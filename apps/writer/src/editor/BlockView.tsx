// One block in the stream. Borderless: the focused block gets a 2px accent rail in the page
// gutter (text never shifts) and a compact action strip beneath it.
import type { Block } from '@kn/core';
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BlockStyle } from '../store/chapter-styles.ts';
import { isBlockComplete } from '../store/sanitize.ts';
import { Glyph } from '../ui/Glyph.tsx';
import { Txt } from '../ui/Txt.tsx';
import { useTheme } from '../ui/theme.tsx';
import { BlockStrip, type BlockActionHandlers } from './BlockStrip.tsx';
import type { Selection } from './inline-edit.ts';
import { DialogueBlockEditor } from './DialogueBlockEditor.tsx';
import { GimmickPill } from './GimmickPill.tsx';
import { ProseBlockEditor } from './ProseBlockEditor.tsx';
import { SceneBreakEditor } from './SceneBreakEditor.tsx';

export type { BlockActionHandlers };

export interface BlockViewProps extends BlockActionHandlers {
  block: Block;
  selected: boolean;
  autoFocus: boolean;
  /** Whether a module block's gimmick is enabled in this novel. */
  moduleEnabled: boolean;
  onSelect(id: string): void;
  onChange(block: Block): void;
  onOpenGimmick(id: string): void;
  blockStyle?: BlockStyle;
  samsungSafeIme?: boolean;
  selection?: Selection;
  onSelectionChange?(blockId: string, sel: Selection): void;
}

function Body(p: BlockViewProps): ReactNode {
  const { block } = p;
  const select = (): void => p.onSelect(block.id);
  const rich = {
    focused: p.selected,
    blockStyle: p.blockStyle,
    samsungSafeIme: !!p.samsungSafeIme,
    selection: p.selection,
    onSelectionChange: (sel: Selection): void => p.onSelectionChange?.(block.id, sel),
  };
  switch (block.kind) {
    case 'prose':
      return (
        <ProseBlockEditor
          block={block}
          autoFocus={p.autoFocus}
          {...rich}
          onChange={p.onChange}
          onSelect={select}
        />
      );
    case 'dialogue':
      return (
        <DialogueBlockEditor
          block={block}
          autoFocus={p.autoFocus}
          {...rich}
          onChange={p.onChange}
          onSelect={select}
        />
      );
    case 'scene-break':
      return (
        <SceneBreakEditor
          block={block}
          autoFocus={false}
          expanded={p.selected}
          onChange={p.onChange}
          onSelect={select}
        />
      );
    case 'module':
      return (
        <GimmickPill
          block={block}
          enabled={p.moduleEnabled}
          onOpen={() => p.onOpenGimmick(block.id)}
        />
      );
  }
}

function BlockViewImpl(p: BlockViewProps): ReactNode {
  const { block } = p;
  const { colors } = useTheme();
  const rail = block.kind === 'dialogue' ? (block.accentColor ?? colors.accent) : colors.accent;
  return (
    <Pressable
      onPress={() => p.onSelect(block.id)}
      testID={`block-${block.id}`}
      style={styles.block}
    >
      {p.selected && block.kind !== 'module' ? (
        <View style={[styles.rail, { backgroundColor: rail }]} pointerEvents="none" />
      ) : null}
      <Body {...p} />
      {block.beatStop && !p.selected && block.kind !== 'module' ? (
        <View style={styles.hint}>
          <Glyph name="pause" size={11} color="inkMuted" />
          <Txt variant="caption" color="inkMuted">
            Beat stop
          </Txt>
        </View>
      ) : null}
      {isBlockComplete(block) ? null : (
        <View style={styles.hint}>
          <Glyph name="edit-3" size={12} color="warm" />
          <Txt variant="caption" color="warm">
            Not saved until filled in
          </Txt>
        </View>
      )}
      {p.selected ? (
        <BlockStrip
          block={block}
          onChange={p.onChange}
          onToggleBeat={p.onToggleBeat}
          onMove={p.onMove}
          onDelete={p.onDelete}
        />
      ) : null}
    </Pressable>
  );
}

/** Memoized: typing in one block must not re-render the others (handlers are stable by id). */
export const BlockView = memo(BlockViewImpl);

const styles = StyleSheet.create({
  block: { paddingVertical: 6, gap: 4 },
  /** Sits in the page gutter (margins are >= 12dp), so prose never shifts when focus moves. */
  rail: { position: 'absolute', left: -9, top: 6, bottom: 6, width: 2, borderRadius: 1 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
