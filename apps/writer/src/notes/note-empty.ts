// Pure rule for abandoned notes: a note left with no title and no text is a ghost and is removed.
// Scene breaks count as content (the Author placed them on purpose), so they keep the note.
export interface EmptyCheckBlock {
  kind: string;
  text?: string;
}

export function isNoteEmpty(title: string, blocks: readonly EmptyCheckBlock[]): boolean {
  if (title.trim() !== '') return false;
  return blocks.every((b) => b.kind !== 'scene-break' && (b.text ?? '').trim() === '');
}

/**
 * Remove on exit only when the note was empty when opened AND is empty now, so an existing note
 * the Author merely emptied is never deleted behind their back.
 */
export function shouldDeleteOnExit(
  emptyAtOpen: boolean,
  title: string,
  blocks: readonly EmptyCheckBlock[],
): boolean {
  return emptyAtOpen && isNoteEmpty(title, blocks);
}
