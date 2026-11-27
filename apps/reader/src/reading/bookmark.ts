import { isUlid } from '@kn/core/guard';
import { readJson, writeJson } from '../storage.ts';

export interface Bookmark {
  seasonId: string;
  chapterId: string;
  blockId: string;
  savedAt: number;
}

const key = (novelId: string): string => `kn:bookmark:${novelId}`;

function isBookmark(v: unknown): v is Bookmark {
  const b = v as Partial<Bookmark> | null;
  return (
    !!b &&
    typeof b.seasonId === 'string' &&
    typeof b.chapterId === 'string' &&
    isUlid(b.blockId) &&
    typeof b.savedAt === 'number'
  );
}

export const readBookmark = (novelId: string): Bookmark | null =>
  readJson(key(novelId), isBookmark);

export function saveBookmark(novelId: string, mark: Omit<Bookmark, 'savedAt'>): void {
  writeJson(key(novelId), { ...mark, savedAt: Date.now() });
}
