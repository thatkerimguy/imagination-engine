// Jumps from a search hit to its chapter block, note, folder or book.
import { router } from 'expo-router';
import { folderHref, routes } from '../routes.ts';
import type { SearchResult } from './search-index.ts';

export function openResult(r: SearchResult): void {
  const t = r.target;
  if ('chapterId' in t) router.push(routes.chapter(t.novelId, t.seasonId, t.chapterId, t.blockId));
  else if ('docId' in t) router.push(routes.note(t.docId, t.folderId));
  else if ('folderId' in t) router.push(folderHref(t.folderId, null));
  else router.push(routes.outline(t.novelId));
}
