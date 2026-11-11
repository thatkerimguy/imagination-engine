import type { Block } from '@ie/story';
import { Plus } from 'lucide-react';
import { currencyFor } from '../project/factory-rpg.ts';
import { newBlock, type MenuBlockType } from '../project/factory.ts';
import { allPassages } from '../project/tree.ts';
import { useT } from '../store.ts';
import { BlockCard } from './BlockCard.tsx';
import { AddBlockButton } from './BlockPicker.tsx';
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
      enemy: doc.enemies?.[0]?.id,
      sequence: doc.sequences?.find((s) => s.kind === 'scene')?.id,
      item: doc.items?.[0]?.id,
      quest: doc.quests?.[0]?.id,
      routine: doc.routines?.[0]?.id,
      currency: currencyFor(doc),
    });
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
  const add = (type: MenuBlockType) => {
    const block = make(type);
    editor.insert(listKey, blocks.length, block);
    focusBlock(block.id);
  };

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
      <AddBlockButton label={t('block.add')} testId={nested ? undefined : 'add-block'} onPick={add}>
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        <span>{nested && blocks.length === 0 ? t('block.addInside') : t('block.add')}</span>
      </AddBlockButton>
    </div>
  );
}
