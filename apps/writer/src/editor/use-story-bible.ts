// `@mention` Story Bible state for the Chapter Editor: notes source, the active `@query` at the
// caret of the selected prose / dialogue block, insertion, manual open (⋯ menu) and the peek card.
import type { Block } from '@kn/core';
import { useCallback, useEffect, useState } from 'react';
import { replaceBlock } from '../store/chapter-ops.ts';
import { useRepository } from '../store/context.tsx';
import type { ChapterDraft } from '../store/use-chapter-draft.ts';
import type { Selection } from './inline-edit.ts';
import { activeMention, insertMention, type MentionNote } from './story-bible.ts';
import { loadStoryBibleNotes, type StoryBibleNote } from './story-bible-source.ts';

type TextBlock = Extract<Block, { kind: 'prose' | 'dialogue' }>;
const isText = (b: Block | undefined): b is TextBlock =>
  b?.kind === 'prose' || b?.kind === 'dialogue';

export interface CaretSource {
  selection: { blockId: string; sel: Selection } | null;
  forceSelection(blockId: string, sel: Selection): void;
}

export function useStoryBible(
  caret: CaretSource,
  blocks: readonly Block[],
  selectedId: string | null,
  update: ChapterDraft['update'],
) {
  const p = { ...caret, blocks, selectedId, update };
  const repo = useRepository();
  const [notes, setNotes] = useState<StoryBibleNote[]>([]);
  const [manual, setManual] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [peek, setPeek] = useState<StoryBibleNote | null>(null);
  const reload = useCallback(() => {
    void loadStoryBibleNotes(repo)
      .then(setNotes)
      .catch(() => undefined);
  }, [repo]);
  useEffect(reload, [reload]);

  const block = p.blocks.find((b) => b.id === p.selectedId);
  const text = isText(block) ? block : undefined;
  const sel = text && p.selection?.blockId === text.id ? p.selection.sel : null;
  const typed = text && sel && sel.start === sel.end ? activeMention(text.text, sel.end) : null;
  const key = typed && text ? `${text.id}:${typed.start}` : null;
  const mention = typed && key !== dismissed ? typed : null;

  const findNote = (n: MentionNote): StoryBibleNote | null =>
    notes.find((x) => x.id === n.id) ?? null;
  const close = (): void => {
    setManual(false);
    if (key) setDismissed(key);
  };
  const insert = (n: MentionNote): void => {
    if (!text) return setPeek(findNote(n));
    const at = sel?.end ?? text.text.length;
    const r = insertMention(text.text, mention ?? { query: '', start: at, end: at }, n.title);
    p.update((c) => replaceBlock(c, { ...text, text: r.text }));
    p.forceSelection(text.id, { start: r.cursor, end: r.cursor });
    setManual(false);
  };
  return {
    visible: mention !== null || manual,
    query: mention?.query ?? '',
    notes,
    insert,
    close,
    open: (): void => {
      reload();
      setManual(true);
    },
    peekNote: peek,
    peek: (n: MentionNote): void => setPeek(findNote(n)),
    closePeek: (): void => setPeek(null),
  };
}

export type StoryBible = ReturnType<typeof useStoryBible>;
