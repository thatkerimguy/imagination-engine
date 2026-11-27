// Gathers everything searchable from the repository into plain `SearchSources`.
import { listAllDocs, listAllFolders } from '../store/folders.ts';
import { loadAllItemMeta } from '../store/item-meta.ts';
import type { NovelRepository } from '../store/repository.ts';
import type { SearchSources } from './search-index.ts';

export async function loadSearchSources(repo: NovelRepository): Promise<SearchSources> {
  const chapters: SearchSources['chapters'] = [];
  const novels = await repo.listNovels();
  for (const n of novels)
    for (const s of await repo.listSeasons(n.id))
      for (const c of await repo.listChapters(n.id, s.id))
        chapters.push({
          novelId: n.id,
          novelTitle: n.title,
          seasonId: s.id,
          chapterId: c.id,
          title: c.title,
          blocks: c.blocks,
        });
  const folders = (await listAllFolders(repo)).map((f) => ({
    id: f.id,
    title: f.title,
    parentFolderId: f.parentFolderId,
  }));
  const docs = (await listAllDocs(repo)).map((d) => ({
    id: d.id,
    title: d.title,
    folderId: d.parentFolderId,
    blocks: d.blocks,
    kind: d.kind,
  }));
  return {
    novels: novels.map((n) => ({
      id: n.id,
      title: n.title,
      ...(n.subtitle ? { subtitle: n.subtitle } : {}),
    })),
    chapters,
    folders,
    docs,
    meta: await loadAllItemMeta(repo),
  };
}
