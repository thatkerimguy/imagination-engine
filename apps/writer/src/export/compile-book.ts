// Gathers a novel or a Notes folder into a CompiledBook (the serializers' input), honouring the
// Author's chosen chapter selection and order.
import type { NovelRepository } from '../store/repository.ts';
import { loadChapterStyles } from '../store/chapter-styles.ts';
import { getDoc, getFolder } from '../store/folders.ts';
import { loadItemMeta } from '../store/item-meta.ts';
import type { BookSection, CompiledBook } from './book-model.ts';
import { listFolderNotes } from './compile-source.ts';

export type { CompiledBook } from './book-model.ts';
export { exportBook } from './export-book.ts';

export async function compileNovel(
  repo: NovelRepository,
  novelId: string,
  opts: { order?: readonly string[] } = {},
): Promise<CompiledBook> {
  const novel = await repo.requireNovel(novelId);
  const byId = new Map<string, BookSection>();
  for (const season of await repo.listSeasons(novelId)) {
    for (const c of await repo.listChapters(novelId, season.id))
      byId.set(c.id, {
        id: c.id,
        title: c.title,
        blocks: c.blocks,
        ...(c.blueprints ? { blueprints: c.blueprints } : {}),
        styles: await loadChapterStyles(repo, c.id),
      });
  }
  const ids = opts.order ?? [...byId.keys()];
  const meta = await loadItemMeta(repo, novelId);
  return {
    title: novel.title,
    ...(novel.subtitle ? { subtitle: novel.subtitle } : {}),
    author: novel.author,
    ...(meta.coverUri ? { cover: meta.coverUri } : {}),
    sections: ids.map((id) => byId.get(id)).filter((s): s is BookSection => s !== undefined),
  };
}

export async function compileFolder(
  repo: NovelRepository,
  folderId: string,
  opts: { order?: readonly string[]; author?: string } = {},
): Promise<CompiledBook> {
  const folder = await getFolder(repo, folderId);
  const ids = opts.order ?? (await listFolderNotes(repo, folderId)).map((e) => e.id);
  const sections: BookSection[] = [];
  for (const id of ids) {
    const doc = await getDoc(repo, id);
    if (doc)
      sections.push({
        id,
        title: doc.title,
        blocks: doc.blocks,
        styles: await loadChapterStyles(repo, id),
      });
  }
  const meta = await loadItemMeta(repo, folderId);
  return {
    title: folder?.title ?? 'Notes',
    author: opts.author ?? '',
    ...(meta.coverUri ? { cover: meta.coverUri } : {}),
    sections,
  };
}
