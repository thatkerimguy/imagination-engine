// Hard (immediate, unrecoverable) deletes for notes and folders. The Author-facing delete moves
// items to Trash instead (trash.ts); these remain for discarding never-touched empty drafts.
// ON DELETE CASCADE removes sub-folders, notes, bodies, links and growth logs; the settings-table
// sidecars of every removed id are deleted here so nothing is left behind.
import { STORY_KINDS } from '../notes/kind-meta.ts';
import { descendantFolderIds } from './folders.ts';
import type { NovelRepository } from './repository.ts';
import { sidecarKeysOf } from './trash.ts';

async function hardDelete(repo: NovelRepository, ids: readonly string[]): Promise<void> {
  const inside = new Set(ids);
  for (const n of await repo.db.listNodes({ kinds: [...STORY_KINDS], includeDeleted: true }))
    if (n.parentId && inside.has(n.parentId)) inside.add(n.id);
  await repo.db.deleteNodes([...ids]);
  for (const id of inside) for (const k of sidecarKeysOf(id)) await repo.docs.remove(k);
  repo.notifyChanged();
}

/** Deletes the folder, every sub-folder, every document inside, and their sidecars. */
export async function deleteFolderRecursive(repo: NovelRepository, id: string): Promise<void> {
  await hardDelete(repo, await descendantFolderIds(repo, id));
}

export async function deleteDoc(repo: NovelRepository, id: string): Promise<void> {
  await hardDelete(repo, [id]);
}
