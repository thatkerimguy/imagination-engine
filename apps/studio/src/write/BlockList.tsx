import type { Block } from '@ie/story';
import { Plus } from 'lucide-react';
import { MenuButton, type MenuItem } from '../components/Menu.tsx';
import { BLOCK_MENU, newBlock, type MenuBlockType } from '../project/factory.ts';
import { allPassages } from '../project/tree.ts';
import { useT } from '../store.ts';
import { BlockCard } from './BlockCard.tsx';
import { BLOCK_ICON, blockHint, blockName } from './blockInfo.ts';
import { focusBlock, useWrite } from './context.ts';

/** New block with defaults taken from the project (the first character, variable, passage). */
export function useNewBlock(): (type: MenuBlockType) => Block {
  const { doc } = useWrite();
  return (type) =>
    newBlock(type, {
      speaker: doc.characters[0]?.id,
      variable: doc.variables[0]?.id,
      textVariable: doc.variables.find((v) => v.type === 'text')?.id,
      passage: allPassages(doc).find((p) => p.id !== doc.start)?.id ?? doc.start,
      track: doc.audio?.tracks[0]?.id,
      sound: doc.audio?.sounds[0]?.id,
    });
}

/** The block menu: every block an author can add, with a one-line hint. */
export function useBlockMenu(onPick: (type: MenuBlockType) => void): MenuItem[] {
  const t = useT();
  return BLOCK_MENU.map((type: MenuBlockType) => ({
    id: type,
    label: t(blockName(type)),
    hint: t(blockHint(type)),
    icon: BLOCK_ICON[type],
    onSelect: () => onPick(type),
  }));
}

interface BlockListProps {
  readonly listKey: string;
  readonly blocks: readonly Block[];
  /** Nested lists (inside an option or a branch) are quieter and indented. */
  readonly nested?: boolean;
  readonly testId?: string;
}

export function BlockList({ listKey, blocks, nested, testId }: BlockListProps) {
  const t = useT();
  const { editor } = useWrite();
  const make = useNewBlock();
  const menu = useBlockMenu((type) => {
    const block = make(type);
    editor.insert(listKey, blocks.length, block);
    focusBlock(block.id);
  });

  return (
    <div className={nested ? 'blocks blocks--nested' : 'blocks'} data-testid={testId}>
      {blocks.map((block, index) => (
        <BlockCard
          key={block.id}
          block={block}
          listKey={listKey}
          index={index}
          count={blocks.length}
        />
      ))}
      <MenuButton
        label={t('block.add')}
        items={menu}
        className="blocks__add"
        testId={nested ? undefined : 'add-block'}
      >
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        <span>{nested && blocks.length === 0 ? t('block.addInside') : t('block.add')}</span>
      </MenuButton>
    </div>
  );
}
