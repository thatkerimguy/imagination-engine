// The chapter stream's block rows. Each row is memoized with id-taking, ref-stable handlers (see
// use-block-handlers.ts), so a keystroke in block i re-renders block i only — never its 249
// siblings in a 10,000-word chapter (DIRECTIVE-06 D3). Stays a plain ScrollView child: no
// FlashList recycling under multiline TextInputs (Android IME caret instability).
import type { Block } from '@kn/core';
import { memo, type ReactNode } from 'react';
import { View } from 'react-native';
import { EmptyState } from '../ui/Page.tsx';
import type { ChapterStyles } from '../store/chapter-styles.ts';
import { BlockView, type BlockViewProps } from './BlockView.tsx';
import type { Selection } from './inline-edit.ts';

type RowHandlers = Pick<
  BlockViewProps,
  | 'onSelect'
  | 'onChange'
  | 'onOpenGimmick'
  | 'onToggleBeat'
  | 'onMove'
  | 'onDelete'
  | 'onSelectionChange'
>;

interface RowProps extends RowHandlers {
  block: Block;
  selected: boolean;
  autoFocus: boolean;
  moduleEnabled: boolean;
  blockStyle?: BlockViewProps['blockStyle'];
  samsungSafeIme?: boolean;
  selection?: Selection;
  onLayout(id: string, y: number): void;
}

const BlockRow = memo(function BlockRow({ onLayout, ...p }: RowProps): ReactNode {
  return (
    <View onLayout={(e) => onLayout(p.block.id, e.nativeEvent.layout.y)}>
      <BlockView {...p} />
    </View>
  );
});

export interface ChapterBlocksProps extends RowHandlers {
  blocks: readonly Block[];
  selectedId: string | null;
  focusId: string | null;
  enabledModules: readonly string[];
  styles: ChapterStyles;
  samsungSafeIme?: boolean;
  forcedSelection(blockId: string): Selection | undefined;
  onLayout(id: string, y: number): void;
}

export function ChapterBlocks({
  blocks,
  selectedId,
  focusId,
  enabledModules,
  styles,
  forcedSelection,
  ...rest
}: ChapterBlocksProps): ReactNode {
  if (blocks.length === 0)
    return (
      <EmptyState
        icon="edit-3"
        title="A blank page"
        body="Use the toolbar below to add prose, dialogue, a scene break or a gimmick."
      />
    );
  return blocks.map((block) => (
    <BlockRow
      key={block.id}
      {...rest}
      block={block}
      selected={selectedId === block.id}
      autoFocus={focusId === block.id}
      moduleEnabled={block.kind !== 'module' || enabledModules.includes(block.moduleId)}
      blockStyle={styles[block.id]}
      selection={forcedSelection(block.id)}
    />
  ));
}
