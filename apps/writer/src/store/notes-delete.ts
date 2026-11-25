// Hard (immediate, unrecoverable) deletes for notes and folders. The Author-facing delete moves
// items to Trash instead (trash.ts); these remain for discarding never-touched empty drafts.
import { chapterStylesKey } from './chapter-styles.ts';
import { descendantFolderIds, docKey, folderKey, scanDocs } from './folders.ts';
import type { NovelRepository } from './repository.ts';

/** Sidecars removed with an item. Kept here so delete never leaves orphans behind. */
const sidecarKeys = (id: string): string[] => [
  `meta/item/${id}`,
  `versions/doc:${id}`,
  chapterStylesKey(id),
];

/** Deletes the folder, every sub-folder, every document inside, and their sidecars. */
export async function deleteFolderRecursive(repo: NovelRepository, id: string): Promise<void> {
  const ids = new Set(await descendantFolderIds(repo, id));
  for (const d of await scanDocs(repo))
    if (d.parentFolderId && ids.has(d.parentFolderId)) await removeDocKeys(repo, d.id);
  for (const fid of ids) {
    await repo.docs.remove(folderKey(fid));
    await repo.docs.remove(`meta/item/${fid}`);
  }
  repo.notifyChanged();
}

async function removeDocKeys(repo: NovelRepository, id: string): Promise<void> {
  await repo.docs.remove(docKey(id));
  for (const k of sidecarKeys(id)) await repo.docs.remove(k);
}

export async function deleteDoc(repo: NovelRepository, id: string): Promise<void> {
  await removeDocKeys(repo, id);
  repo.notifyChanged();
}
