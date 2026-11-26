// Where a backlink row leads: a chapter opens in the chapter editor, a document in the note editor.
import { router } from 'expo-router';
import { useCallback } from 'react';
import { routes } from '../routes.ts';
import type { Backlink } from '../store/backlinks.ts';

export function backlinkHref(b: Backlink): string {
  if (b.sourceKind === 'chapter' && b.bookId && b.seasonId)
    return routes.chapter(b.bookId, b.seasonId, b.sourceId);
  return routes.note(b.sourceId);
}

export function useOpenBacklink(): (b: Backlink) => void {
  return useCallback((b: Backlink) => router.push(backlinkHref(b)), []);
}
