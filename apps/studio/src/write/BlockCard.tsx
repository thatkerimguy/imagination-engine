import { isAudioAction, isStageAction, type Block } from '@ie/story';
import { ArrowDown, ArrowUp, Copy, Ellipsis, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { MenuButton } from '../components/Menu.tsx';
import { useProject } from '../project/store.ts';
import { useT } from '../store.ts';
import { BLOCK_ICON, blockKind, blockName } from './blockInfo.ts';
import { AudioEditor } from './blocks/AudioEditors.tsx';
import { StageEditor } from './blocks/StageEditors.tsx';
import { focusBlock, useWrite } from './context.ts';
import { ChoiceEditor } from './blocks/ChoiceEditor.tsx';
import { FightEditor } from './blocks/FightEditor.tsx';
import { CheckEditor, IfEditor, RandomEditor } from './blocks/BranchEditors.tsx';
import { FlowEditor, SetEditor } from './blocks/LogicEditors.tsx';
import {
  EndEditor,
  InputEditor,
  LineEditor,
  NoteEditor,
  PauseEditor,
} from './blocks/TextEditors.tsx';
import { ProblemText } from './ProblemText.tsx';
import { useNewBlock } from './BlockList.tsx';

interface BlockCardProps {
  readonly block: Block;
  readonly listKey: string;
  readonly index: number;
  readonly count: number;
}

function Editor({ block, listKey, index }: Omit<BlockCardProps, 'count'>) {
  switch (block.type) {
    case 'narration':
    case 'dialogue':
      return <LineEditor block={block} listKey={listKey} index={index} />;
    case 'note':
      return <NoteEditor block={block} />;
    case 'pause':
      return <PauseEditor block={block} />;
    case 'input':
      return <InputEditor block={block} />;
    case 'end':
      return <EndEditor block={block} />;
    case 'choice':
      return <ChoiceEditor block={block} />;
    case 'if':
      return <IfEditor block={block} />;
    case 'check':
      return <CheckEditor block={block} />;
    case 'fight':
      return <FightEditor block={block} />;
    case 'random':
      return <RandomEditor block={block} />;
    case 'set':
      return <SetEditor block={block} />;
    case 'jump':
    case 'call':
    case 'return':
      return <FlowEditor block={block} />;
    case 'action':
      if (isAudioAction(block.action)) return <AudioEditor block={block} />;
      if (isStageAction(block.action)) return <StageEditor block={block} />;
      return <FlowEditor block={block} />;
  }
}

/** One block: a quiet type icon, the editor for its type, a menu, and its problems. */
export function BlockCard({ block, listKey, index, count }: BlockCardProps) {
  const t = useT();
  const { editor, problems } = useWrite();
  const reveal = useProject((s) => s.reveal);
  const clearReveal = useProject((s) => s.clearReveal);
  const ref = useRef<HTMLElement>(null);
  const make = useNewBlock();
  const kind = blockKind(block);
  const Icon = BLOCK_ICON[kind];
  // Translation gaps are normal while drafting in one language; they live in the problems list
  // and the Translate view, not under every line.
  const own = (problems.get(block.id) ?? []).filter((p) => p.code !== 'missing-translation');

  useEffect(() => {
    if (reveal !== block.id || !ref.current) return;
    ref.current.scrollIntoView({ block: 'center' });
    ref.current.dataset.revealed = 'true';
    const node = ref.current;
    const timer = setTimeout(() => delete node.dataset.revealed, 1600);
    clearReveal();
    return () => clearTimeout(timer);
  }, [reveal, block.id, clearReveal]);

  return (
    <section
      ref={ref}
      className={`block block--${block.type}`}
      data-block-id={block.id}
      data-testid={`block-${kind}`}
      aria-label={t(blockName(kind))}
    >
      <span className="block__icon" title={t(blockName(kind))} aria-hidden="true">
        <Icon size={16} strokeWidth={1.5} />
      </span>
      <div className="block__body">
        <Editor block={block} listKey={listKey} index={index} />
        {own.length > 0 && (
          <ul className="block__problems">
            {own.map((p, i) => (
              <li key={i} data-severity={p.severity}>
                <ProblemText problem={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <MenuButton
        label={t('block.menu')}
        className="block__menu"
        align="end"
        testId="block-menu"
        items={[
          {
            id: 'add',
            label: t('block.addLine'),
            icon: Plus,
            onSelect: () => {
              const next = make('narration');
              editor.insert(listKey, index + 1, next);
              focusBlock(next.id);
            },
          },
          {
            id: 'up',
            label: t('block.up'),
            icon: ArrowUp,
            disabled: index === 0,
            onSelect: () => editor.move(block.id, -1),
          },
          {
            id: 'down',
            label: t('block.down'),
            icon: ArrowDown,
            disabled: index === count - 1,
            onSelect: () => editor.move(block.id, 1),
          },
          {
            id: 'duplicate',
            label: t('block.duplicate'),
            icon: Copy,
            onSelect: () => editor.duplicate({ block, listKey, index, passageId: '' }),
          },
          {
            id: 'delete',
            label: t('block.delete'),
            icon: Trash2,
            danger: true,
            onSelect: () => editor.remove(block.id),
          },
        ]}
      >
        <Ellipsis size={16} strokeWidth={1.5} aria-hidden="true" />
      </MenuButton>
    </section>
  );
}
