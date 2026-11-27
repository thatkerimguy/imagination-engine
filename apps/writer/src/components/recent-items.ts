// Pure model behind the Recent strip: the newest chapters / documents, carrying their story kind.
import { isStoryKind, type StoryKind } from '../notes/kind-meta.ts';
import type { ItemMeta } from '../store/item-meta.ts';

export interface RecentItem {
  id: string;
  kind: 'chapter' | 'doc';
  title: string;
  /** Story kind of a doc (note, character, location, lore). */
  docKind?: StoryKind;
  /** Book title for chapters, empty for notes. */
  book: string;
  /** max(updatedAt, lastOpenedAt). */
  at: number;
  locked: boolean;
  novelId?: string;
  seasonId?: string;
  folderId?: string | null;
}

export interface RecentInput {
  chapters: {
    novelId: string;
    seasonId: string;
    id: string;
    title: string;
    book: string;
    updatedAt: number;
  }[];
  docs: {
    id: string;
    title: string;
    folderId: string | null;
    updatedAt: number;
    kind?: StoryKind;
  }[];
  meta: ReadonlyMap<string, ItemMeta>;
  /** Locked-and-not-unlocked predicate (defaults to `meta.locked`). */
  isLocked?(id: string): boolean;
}

/** The most recently edited / opened chapters and notes, newest first. Pure. */
export function recentItems(input: RecentInput, limit = 5): RecentItem[] {
  const at = (id: string, updatedAt: number): number =>
    Math.max(updatedAt, input.meta.get(id)?.lastOpenedAt ?? 0);
  const locked = input.isLocked ?? ((id: string) => input.meta.get(id)?.locked === true);
  const all: RecentItem[] = [
    ...input.chapters.map((c) => ({
      id: c.id,
      kind: 'chapter' as const,
      title: c.title,
      book: c.book,
      at: at(c.id, c.updatedAt),
      locked: locked(c.id),
      novelId: c.novelId,
      seasonId: c.seasonId,
    })),
    ...input.docs.map((d) => ({
      id: d.id,
      kind: 'doc' as const,
      title: d.title,
      book: '',
      at: at(d.id, d.updatedAt),
      locked: locked(d.id),
      folderId: d.folderId,
      docKind: isStoryKind(d.kind) ? d.kind : 'note',
    })),
  ];
  return all.sort((a, b) => b.at - a.at).slice(0, limit);
}
