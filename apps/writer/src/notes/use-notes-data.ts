// Loads one Notes level (root or a folder): its folders and documents with item meta, the
// breadcrumb trail and the persisted sort mode — reactive to every repository write.
import { useCallback } from 'react';
import { blockText } from '../search/search-index.ts';
import { useRepoQuery, useRepository } from '../store/context.tsx';
import {
  breadcrumbs,
  getFolder,
  listAllDocs,
  listAllFolders,
  type FolderRecord,
} from '../store/folders.ts';
import {
  loadAllItemMeta,
  sortItems,
  type ItemMeta,
  type SortMode,
  type SortableItem,
} from '../store/item-meta.ts';

export const SORT_KEY = 'notes-sort';
const SORT_MODES: readonly SortMode[] = [
  'manual',
  'date-edited',
  'date-created',
  'name-asc',
  'type',
  'word-count',
];

export interface NoteItem extends SortableItem {
  kind: 'folder' | 'doc';
  createdAt: number;
  parentId: string | null;
  /** Folders: how many items sit directly inside. */
  count?: number;
}

interface Level {
  items: NoteItem[];
  meta: ReadonlyMap<string, ItemMeta>;
  crumbs: FolderRecord[];
  folder: FolderRecord | null;
  sort: SortMode;
}

const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length;

export function useNotesData(folderId: string | null) {
  const repo = useRepository();
  const q = useRepoQuery<Level>(`notes:${folderId ?? 'root'}`, async (r) => {
    const [folders, docs, meta, stored] = await Promise.all([
      listAllFolders(r),
      listAllDocs(r),
      loadAllItemMeta(r),
      r.docs.read<string>(`setting/${SORT_KEY}`),
    ]);
    const childCount = (id: string): number =>
      folders.filter((f) => f.parentFolderId === id).length +
      docs.filter((d) => d.parentFolderId === id).length;
    const items: NoteItem[] = [
      ...folders
        .filter((f) => f.parentFolderId === folderId)
        .map((f) => ({
          id: f.id,
          kind: 'folder' as const,
          title: f.title,
          updatedAt: f.updatedAt,
          createdAt: f.createdAt,
          parentId: f.parentFolderId,
          count: childCount(f.id),
        })),
      ...docs
        .filter((d) => d.parentFolderId === folderId)
        .map((d) => ({
          id: d.id,
          kind: 'doc' as const,
          title: d.title,
          updatedAt: d.updatedAt,
          createdAt: d.createdAt,
          parentId: d.parentFolderId,
          words: countWords(d.blocks.map(blockText).join(' ')),
        })),
    ];
    const sort = SORT_MODES.find((m) => m === stored?.data) ?? 'date-edited';
    return {
      items: sortItems(items, sort, meta),
      meta,
      sort,
      crumbs: folderId ? await breadcrumbs(r, folderId) : [],
      folder: folderId ? await getFolder(r, folderId) : null,
    };
  });
  const setSort = useCallback(
    async (mode: SortMode): Promise<void> => {
      await repo.docs.write(`setting/${SORT_KEY}`, mode);
      repo.notifyChanged();
    },
    [repo],
  );
  return { ...q, setSort };
}
