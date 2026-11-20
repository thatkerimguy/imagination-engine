import type { ChapterDocument } from '@kn/core';

/** Words in a chapter's prose and dialogue blocks. */
export function chapterWords(chapter: ChapterDocument): number {
  let n = 0;
  for (const b of chapter.blocks) {
    if (b.kind === 'prose' || b.kind === 'dialogue')
      n += b.text.split(/\s+/).filter(Boolean).length;
  }
  return n;
}
