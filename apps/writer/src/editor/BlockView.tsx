import type { Block } from '@kn/core';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { BlockStyle } from '../store/chapter-styles.ts';
import { isBlockComplete } from '../store/sanitize.ts';
import { AppText } from '../ui/AppText.tsx';
import { Icon } from '../ui/Icon.tsx';
import { StatusBadge } from '../ui/layout.tsx';
import { shape, space } from '../ui/m3-tokens.ts';
import { makeStyles } from '../ui/theme.tsx';
import { BlockActions, type BlockActionHandlers } from './BlockActions.tsx';
import type { Selection } from './inline-edit.ts';
import { DialogueBlockEditor } from './DialogueBlockEditor.tsx';
import { GimmickPill } from './GimmickPill.tsx';
import { ProseBlockEditor, ProseStyleControl } from './ProseBlockEditor.tsx';
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

const useStyles = makeStyles((t) => ({
  block: {
    borderRadius: shape.medium,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: space.sm,
    gap: space.sm,
  },
  selected: {
    borderColor: t.m3.outlineVariant,
    backgroundColor: t.m3.surfaceContainerLow,
  },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  actions: { gap: space.sm, paddingTop: space.xs },
}));

export function BlockView(p: BlockViewProps): ReactNode {
  const { block } = p;
  const s = useStyles();
  return (
    <Pressable
      onPress={() => p.onSelect(block.id)}
      testID={`block-${block.id}`}
      style={[s.block, p.selected && s.selected]}
    >
      <Body {...p} />
      {block.beatStop && !p.selected ? (
        <StatusBadge icon="pause" label="Beat" tone="tertiary" />
      ) : null}
      {isBlockComplete(block) ? null : (
        <View style={s.hint}>
          <Icon name="edit-note" size={16} color="tertiary" />
          <AppText variant="bodySmall" color="tertiary">
            Not saved until filled in
          </AppText>
        </View>
      )}
      {p.selected ? (
        <View style={s.actions}>
          {block.kind === 'prose' ? (
            <ProseStyleControl block={block} onChange={p.onChange} />
          ) : null}
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
