// What a book can be compiled from: a novel's chapters (by season) or a Notes folder's notes.
import type { NovelRepository } from '../store/repository.ts';
import { descendantFolderIds, getFolder, listAllDocs, listAllFolders } from '../store/folders.ts';
import { loadAllItemMeta, sortItems, type SortableItem } from '../store/item-meta.ts';

export interface CompileEntry {
  id: string;
  title: string;
  /** Season title (novels) or the parent folder's title (folders). */
  group?: string;
}

export async function listNovelEntries(
  repo: NovelRepository,
  novelId: string,
): Promise<CompileEntry[]> {
  const out: CompileEntry[] = [];
  for (const season of await repo.listSeasons(novelId)) {
    for (const c of await repo.listChapters(novelId, season.id))
      out.push({ id: c.id, title: c.title, group: season.title });
  }
  return out;
}

/** Notes of a folder and its sub-folders, depth-first, in manual / sort order. */
export async function listFolderNotes(
  repo: NovelRepository,
  folderId: string,
): Promise<CompileEntry[]> {
  if (!(await getFolder(repo, folderId))) return [];
  const [docs, folders, meta] = await Promise.all([
    listAllDocs(repo),
    listAllFolders(repo),
    loadAllItemMeta(repo),
  ]);
  const inScope = new Set(await descendantFolderIds(repo, folderId));
  const asItem =
    (kind: 'doc' | 'folder') =>
    (x: { id: string; title: string; updatedAt: number }): SortableItem => ({
      id: x.id,
      kind,
      title: x.title,
      updatedAt: x.updatedAt,
    });
  const out: CompileEntry[] = [];
  const walk = (fid: string, label: string): void => {
    const here = docs.filter((d) => d.parentFolderId === fid).map(asItem('doc'));
    for (const d of sortItems(here, 'manual', meta))
      out.push({ id: d.id, title: d.title, group: label });
    const kids = folders.filter((f) => f.parentFolderId === fid && inScope.has(f.id));
    for (const f of sortItems(kids.map(asItem('folder')), 'manual', meta)) walk(f.id, f.title);
  };
  walk(folderId, (await getFolder(repo, folderId))?.title ?? '');
  return out;
}
