// Notes workspace folders on the v2 node tree (`folder` nodes, bookId null), plus the note
// document operations re-exported from notes-docs.ts. Shared node plumbing: notes-nodes.ts.
import { NotFoundError, ValidationError } from './errors.ts';
import { newSlugId } from './ids.ts';
import {
  activeNodes,
  folderNode,
  nodeOf,
  scanFolders,
  toDoc,
  toFolder,
  type DocRecord,
  type FolderRecord,
} from './notes-nodes.ts';
import type { NovelRepository } from './repository.ts';
import { nextPosition } from './repository-writes.ts';

export * from './notes-docs.ts';
export {
  scanFolders,
  fallbackTitle,
  UNTITLED,
  type DocRecord,
  type FolderRecord,
  type NoteBlock,
} from './notes-nodes.ts';

// ── Folders ───────────────────────────────────────────────────────────────────────────────

export async function getFolder(repo: NovelRepository, id: string): Promise<FolderRecord | null> {
  const n = await nodeOf(repo, id, 'folder');
  return n ? toFolder(n) : null;
}

export async function listAllFolders(repo: NovelRepository): Promise<FolderRecord[]> {
  return (await activeNodes(repo)).folders.map(toFolder);
}

export async function createFolder(
  repo: NovelRepository,
  title: string,
  parentFolderId: string | null,
  now = Date.now(),
): Promise<FolderRecord> {
  const name = title.trim();
  if (!name) throw new ValidationError('Folder', ['A folder needs a name']);
  if (parentFolderId && !(await getFolder(repo, parentFolderId)))
    throw new NotFoundError(`Folder ${parentFolderId}`);
  const at = new Date(now).toISOString();
  const node = folderNode(
    newSlugId(),
    parentFolderId,
    name,
    await nextPosition(repo.db, parentFolderId),
    at,
  );
  await repo.db.putNodes([{ node }]);
  repo.notifyChanged();
  return toFolder(node);
}

async function patchFolder(
  repo: NovelRepository,
  id: string,
  patch: { title?: string; parentId?: string | null },
): Promise<FolderRecord> {
  const f = await nodeOf(repo, id, 'folder');
  if (!f) throw new NotFoundError(`Folder ${id}`);
  const next = { ...f, ...patch, updatedAt: new Date().toISOString() };
  await repo.db.putNodes([{ node: next }]);
  repo.notifyChanged();
  return toFolder(next);
}

export function renameFolder(repo: NovelRepository, id: string, title: string) {
  const name = title.trim();
  if (!name) throw new ValidationError('Folder', ['A folder needs a name']);
  return patchFolder(repo, id, { title: name });
}

/** Moves a folder under `parentId` (`null` = root). Refuses to move a folder into itself. */
export async function moveFolder(repo: NovelRepository, id: string, parentId: string | null) {
  for (const crumb of parentId ? await breadcrumbs(repo, parentId) : [])
    if (crumb.id === id) throw new ValidationError('Folder', ['Cannot move a folder into itself']);
  return patchFolder(repo, id, { parentId });
}

/** Root → `folderId` path (inclusive). Stops on a missing parent or a cycle. */
export async function breadcrumbs(repo: NovelRepository, folderId: string) {
  const path: FolderRecord[] = [];
  const seen = new Set<string>();
  let id: string | null = folderId;
  while (id && !seen.has(id)) {
    seen.add(id);
    const f = await getFolder(repo, id);
    if (!f) break;
    path.unshift(f);
    id = f.parentFolderId;
  }
  return path;
}

/** Direct sub-folders and documents of a folder (`null` = the Notes root). */
export async function listChildren(repo: NovelRepository, parentId: string | null) {
  const all = await activeNodes(repo);
  const folders = all.folders.filter((f) => f.parentId === parentId).map(toFolder);
  const docs: DocRecord[] = [];
  for (const d of all.notes) if (d.parentId === parentId) docs.push(await toDoc(repo, d));
  return { folders, docs };
}

/** Every folder id inside `id` (inclusive), depth-first. */
export async function descendantFolderIds(repo: NovelRepository, id: string): Promise<string[]> {
  const all = await scanFolders(repo);
  const out: string[] = [];
  const walk = (fid: string): void => {
    if (out.includes(fid)) return;
    out.push(fid);
    for (const f of all) if (f.parentFolderId === fid) walk(f.id);
  };
  walk(id);
  return out;
}
