import type { Block } from '@kn/core';
import { useCallback, useState } from 'react';
import type { WriterModule } from '../modules/registry.ts';
import {
  createBlock,
  createModuleBlock,
  insertBlock,
  moveBlock,
  removeBlock,
  replaceBlock,
  toggleBeatStop,
} from '../store/chapter-ops.ts';
import type { ChapterDraft } from '../store/use-chapter-draft.ts';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import type { InsertChoice } from './InsertBar.tsx';

/** Selection, sheet state and every block mutation for the editor screen. */
export function useEditorActions(update: ChapterDraft['update']) {
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  /** Non-null while the gimmick picker is open; value = insert-after id. */
  const [pickerAfter, setPickerAfter] = useState<{ afterId: string | null } | null>(null);

  const add = useCallback(
    (block: Block, afterId: string | null) => {
      update((c) => insertBlock(c, block, afterId));
      setSelectedId(block.id);
      setFocusId(block.id);
    },
    [update],
  );

  const pick = useCallback(
    (choice: InsertChoice, afterId: string | null) => {
      if (choice === 'gimmick') return setPickerAfter({ afterId });
      add(createBlock(choice), afterId);
    },
    [add],
  );

  const pickModule = useCallback(
    (module: WriterModule) => {
      const afterId = pickerAfter?.afterId ?? null;
      setPickerAfter(null);
      const block = createModuleBlock(module.meta.id, module.meta.version, module.schema.defaults);
      add(block, afterId);
      setSheetId(block.id);
    },
    [add, pickerAfter],
  );

  const remove = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: 'Delete block?',
        message: 'This cannot be undone.',
        confirmLabel: 'Delete',
        destructive: true,
      });
      if (!ok) return;
      update((c) => removeBlock(c, id));
      setSelectedId((s) => (s === id ? null : s));
    },
    [update, confirm],
  );

  return {
    selectedId,
    focusId,
    sheetId,
    pickerOpen: pickerAfter !== null,
    select: setSelectedId,
    openSheet: setSheetId,
    closePicker: () => setPickerAfter(null),
    pick,
    pickModule,
    remove,
    /** Text edits coalesce in undo history (800 ms, same block); other changes are boundaries. */
    change: (block: Block) =>
      update((c) => replaceBlock(c, block), { kind: 'typing', blockId: block.id }),
    toggleBeat: (id: string) => update((c) => toggleBeatStop(c, id)),
    move: (id: string, delta: -1 | 1) => update((c) => moveBlock(c, id, delta)),
  };
}
