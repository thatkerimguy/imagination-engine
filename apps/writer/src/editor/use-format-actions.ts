// Maps formatting-toolbar buttons onto edits of the selected block: inline spans on the selected
// text (via inline-edit), block layout in the chapter-styles sidecar, and block inserts.
import type { Block } from '@kn/core';
import { useCallback, useState } from 'react';
import { createBlock, insertBlock, replaceBlock } from '../store/chapter-ops.ts';
import { setBlockStyle, type BlockStyle, type ChapterStyles } from '../store/chapter-styles.ts';
import type { ChapterDraft } from '../store/use-chapter-draft.ts';
import type { ToolId } from '../store/writer-prefs.ts';
import {
  insertComment,
  insertText,
  toggleMark,
  wrapColor,
  type EditResult,
  type Selection,
} from './inline-edit.ts';
import type { ColorChannel, MarkKind } from './inline-markup.ts';
import type { InsertChoice } from './InsertBar.tsx';

const MARKS: Partial<Record<ToolId, MarkKind>> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strike',
  highlight: 'highlight',
};
const ADDS: Partial<Record<ToolId, InsertChoice>> = {
  addProse: 'prose',
  addDialogue: 'dialogue',
  addScene: 'scene-break',
  addGimmick: 'gimmick',
};
const NEXT_ALIGN = { left: 'center', center: 'right', right: 'left' } as const;

type TextBlock = Extract<Block, { kind: 'prose' | 'dialogue' }>;
const isText = (b: Block | undefined): b is TextBlock =>
  b?.kind === 'prose' || b?.kind === 'dialogue';

export interface FormatActionsInput {
  blocks: readonly Block[];
  styles: ChapterStyles;
  selectedId: string | null;
  defaultAlign: 'left' | 'center' | 'right';
  update: ChapterDraft['update'];
  updateStyles: ChapterDraft['updateStyles'];
  pick(choice: InsertChoice, afterId: string | null): void;
}

export function useFormatActions(p: FormatActionsInput) {
  /** Last selection the focused input reported. */
  const [selection, setSelection] = useState<{ blockId: string; sel: Selection } | null>(null);
  /** Selection to push into the focused input after a toolbar edit. */
  const [forced, setForced] = useState<{ blockId: string; sel: Selection } | null>(null);
  const [colorFor, setColorFor] = useState<ColorChannel | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);

  const block = p.blocks.find((b) => b.id === p.selectedId);
  const style: BlockStyle = (p.selectedId && p.styles[p.selectedId]) || {};

  const onSelectionChange = useCallback(
    (blockId: string, sel: Selection) => setSelection({ blockId, sel }),
    [],
  );

  const editText = (edit: (text: string, sel: Selection) => EditResult): void => {
    if (!isText(block)) return;
    const sel =
      selection?.blockId === block.id
        ? selection.sel
        : { start: block.text.length, end: block.text.length };
    const r = edit(block.text, sel);
    p.update((c) => replaceBlock(c, { ...block, text: r.text }));
    setSelection({ blockId: block.id, sel: r.selection });
    setForced({ blockId: block.id, sel: r.selection });
  };

  const styleBlock = (patch: Partial<Record<keyof BlockStyle, BlockStyle[keyof BlockStyle]>>) => {
    const id = p.selectedId;
    if (id) p.updateStyles((s) => setBlockStyle(s, id, patch));
  };

  const pickColor = (hex: string): void => {
    const channel = colorFor;
    setColorFor(null);
    if (!channel || !isText(block)) return;
    const sel = selection?.blockId === block.id ? selection.sel : { start: 0, end: 0 };
    if (sel.start !== sel.end) return editText((t, s) => wrapColor(t, s, channel, hex));
    const key = channel === 'fg' ? 'fgColor' : 'bgColor';
    styleBlock({ [key]: style[key] === hex ? undefined : hex });
  };

  const onTool = (id: ToolId): void => {
    const mark = MARKS[id];
    if (mark) return editText((t, s) => toggleMark(t, s, mark));
    const add = ADDS[id];
    if (add) return p.pick(add, p.selectedId);
    switch (id) {
      case 'tab':
        return editText((t, s) => insertText(t, s, '\t'));
      case 'h1':
      case 'h2':
      case 'h3': {
        const level = Number(id[1]) as 1 | 2 | 3;
        return styleBlock({ heading: style.heading === level ? undefined : level });
      }
      case 'align':
        return styleBlock({ align: NEXT_ALIGN[style.align ?? p.defaultAlign] });
      case 'quote':
        return styleBlock({ quote: !style.quote });
      case 'bullet':
        return styleBlock({ list: style.list ? undefined : 'bullet' });
      case 'fgColor':
      case 'bgColor':
        return setColorFor((c) => (c === id.slice(0, 2) ? null : (id.slice(0, 2) as ColorChannel)));
      case 'comment':
        return setCommentOpen(true);
      case 'separator': {
        const sep = createBlock('scene-break');
        return p.update((c) => insertBlock(c, sep, p.selectedId));
      }
      default:
        return undefined;
    }
  };

  const addComment = (note: string): void => {
    setCommentOpen(false);
    if (note.trim()) editText((t, s) => insertComment(t, s, note));
  };

  const active: Partial<Record<ToolId, boolean>> = {
    h1: style.heading === 1,
    h2: style.heading === 2,
    h3: style.heading === 3,
    quote: !!style.quote,
    bullet: style.list === 'bullet',
    fgColor: colorFor === 'fg' || !!style.fgColor,
    bgColor: colorFor === 'bg' || !!style.bgColor,
  };

  return {
    onTool,
    active,
    align: style.align ?? p.defaultAlign,
    textSelected: isText(block),
    onSelectionChange,
    selection,
    /** Moves the caret of `blockId` (e.g. after an `@mention` insert). */
    forceSelection: (blockId: string, sel: Selection): void => {
      setSelection({ blockId, sel });
      setForced({ blockId, sel });
    },
    forcedSelection: (blockId: string): Selection | undefined =>
      forced?.blockId === blockId ? forced.sel : undefined,
    colorFor,
    pickColor,
    closeColor: () => setColorFor(null),
    commentOpen,
    addComment,
    closeComment: () => setCommentOpen(false),
  };
}
