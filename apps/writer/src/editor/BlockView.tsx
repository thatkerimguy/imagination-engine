import type { Block } from '@kn/core';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isBlockComplete } from '../store/sanitize.ts';
import { colors, radius, space } from '../ui/legacy-theme.ts';
import { BlockActions, type BlockActionHandlers } from './BlockActions.tsx';
import { DialogueBlockEditor } from './DialogueBlockEditor.tsx';
import { GimmickPill } from './GimmickPill.tsx';
import { ProseBlockEditor, ProseStyleChips } from './ProseBlockEditor.tsx';
import { SceneBreakEditor } from './SceneBreakEditor.tsx';

export interface BlockViewProps extends BlockActionHandlers {
  block: Block;
  selected: boolean;
  autoFocus: boolean;
  /** Whether a module block's gimmick is enabled in this novel. */
  moduleEnabled: boolean;
  onSelect(id: string): void;
  onChange(block: Block): void;
  onOpenGimmick(id: string): void;
}

function Body(p: BlockViewProps): ReactNode {
  const { block } = p;
  const select = (): void => p.onSelect(block.id);
  switch (block.kind) {
    case 'prose':
      return (
        <ProseBlockEditor
          block={block}
          autoFocus={p.autoFocus}
          onChange={p.onChange}
          onSelect={select}
        />
      );
    case 'dialogue':
      return (
        <DialogueBlockEditor
          block={block}
          autoFocus={p.autoFocus}
          onChange={p.onChange}
          onSelect={select}
        />
      );
    case 'scene-break':
      return (
        <SceneBreakEditor block={block} autoFocus={false} onChange={p.onChange} onSelect={select} />
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

export function BlockView(p: BlockViewProps): ReactNode {
  const { block } = p;
  return (
    <Pressable
      onPress={() => p.onSelect(block.id)}
      testID={`block-${block.id}`}
      style={[styles.block, p.selected && styles.selected]}
    >
      <Body {...p} />
      {block.beatStop && !p.selected ? <Text style={styles.beat}>⏸ beat</Text> : null}
      {isBlockComplete(block) ? null : <Text style={styles.hint}>Not saved until filled in</Text>}
      {p.selected ? (
        <View style={styles.actions}>
          {block.kind === 'prose' ? <ProseStyleChips block={block} onChange={p.onChange} /> : null}
          <BlockActions
            block={block}
            onToggleBeat={p.onToggleBeat}
            onMove={p.onMove}
            onInsertBelow={p.onInsertBelow}
            onDelete={p.onDelete}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: space.sm,
    gap: space.sm,
  },
  selected: { borderColor: colors.line, backgroundColor: colors.surface },
  beat: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  hint: { color: colors.warn, fontSize: 12 },
  actions: { gap: space.sm, paddingTop: space.xs },
});
