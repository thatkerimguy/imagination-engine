// Notes workspace: endlessly nested folders (`folder/<id>`) and standalone documents (`doc/<id>`).
// Writer-only records, never published. Documents keep the Author's source text (writer markup
// included); promoting one to a chapter sanitizes it into a @kn/core-valid ChapterDocument.
import type { DialogueBlock, ProseBlock, SceneBreakBlock } from '@kn/core';
import { chapterStylesKey } from './chapter-styles.ts';
import { NotFoundError, ValidationError } from './errors.ts';
import { newSlugId } from './ids.ts';
import type { NovelRepository } from './repository.ts';

/** Blocks a standalone note can hold: everything except gimmick modules. */
export type NoteBlock = ProseBlock | DialogueBlock | SceneBreakBlock;

export interface FolderRecord {
  id: string;
  parentFolderId: string | null;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface DocRecord extends FolderRecord {
  blocks: NoteBlock[];
  /** True while the title is generated from the first words (the Author never named it). */
  autoTitle?: boolean;
}

export const folderKey = (id: string): string => `folder/${id}`;
export const docKey = (id: string): string => `doc/${id}`;
/** Sidecars removed with an item. Kept here so delete never leaves orphans behind. */
const sidecarKeys = (id: string): string[] => [
  `meta/item/${id}`,
  `versions/doc:${id}`,
  chapterStylesKey(id),
];

export const UNTITLED = 'Untitled note';

/** First six words of the first text block, or "Untitled note". Pure. */
export function fallbackTitle(blocks: readonly NoteBlock[]): string {
  for (const b of blocks) {
    if (b.kind === 'scene-break') continue;
    const words = b.text
      .replace(/\{\{[^}]*\}\}/g, ' ')
      .replace(/\{\/?[a-z]+(?::[^}]*)?\}|[*_~=`#>]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    if (words.length) return words.slice(0, 6).join(' ');
  }
  return UNTITLED;
}

async function readData<T>(repo: NovelRepository, key: string): Promise<T | null> {
  return (await repo.docs.read<T>(key))?.data ?? null;
}

// ── Folders ───────────────────────────────────────────────────────────────────────────────

export async function getFolder(repo: NovelRepository, id: string): Promise<FolderRecord | null> {
  return readData<FolderRecord>(repo, folderKey(id));
}

export async function listAllFolders(repo: NovelRepository): Promise<FolderRecord[]> {
  const out: FolderRecord[] = [];
  for (const k of await repo.docs.keys('folder/')) {
    const f = await readData<FolderRecord>(repo, k);
    if (f) out.push(f);
  }
  return out;
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
  const folder: FolderRecord = {
    id: newSlugId(),
    parentFolderId,
    title: name,
    createdAt: now,
    updatedAt: now,
  };
  await repo.docs.write(folderKey(folder.id), folder);
  repo.notifyChanged();
  return folder;
}

async function patchFolder(
  repo: NovelRepository,
  id: string,
  patch: Partial<Pick<FolderRecord, 'title' | 'parentFolderId'>>,
): Promise<FolderRecord> {
  const f = await getFolder(repo, id);
  if (!f) throw new NotFoundError(`Folder ${id}`);
  const next = { ...f, ...patch, updatedAt: Date.now() };
  await repo.docs.write(folderKey(id), next);
  repo.notifyChanged();
  return next;
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
  return patchFolder(repo, id, { parentFolderId: parentId });
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
  const folders = (await listAllFolders(repo)).filter((f) => f.parentFolderId === parentId);
  const docs = (await listAllDocs(repo)).filter((d) => d.parentFolderId === parentId);
  return { folders, docs };
}

/** Every folder id inside `id` (inclusive), depth-first. */
export async function descendantFolderIds(repo: NovelRepository, id: string): Promise<string[]> {
  const all = await listAllFolders(repo);
  const out: string[] = [];
  const walk = (fid: string): void => {
    if (out.includes(fid)) return;
    out.push(fid);
    for (const f of all) if (f.parentFolderId === fid) walk(f.id);
  };
  walk(id);
  return out;
}

/** Deletes the folder, every sub-folder, every document inside, and their sidecars. */
export async function deleteFolderRecursive(repo: NovelRepository, id: string): Promise<void> {
  const ids = new Set(await descendantFolderIds(repo, id));
  for (const d of await listAllDocs(repo))
    if (d.parentFolderId && ids.has(d.parentFolderId)) await removeDocKeys(repo, d.id);
  for (const fid of ids) {
    await repo.docs.remove(folderKey(fid));
    await repo.docs.remove(`meta/item/${fid}`);
  }
  repo.notifyChanged();
}

// ── Documents ─────────────────────────────────────────────────────────────────────────────

export async function getDoc(repo: NovelRepository, id: string): Promise<DocRecord | null> {
  return readData<DocRecord>(repo, docKey(id));
}

export async function listAllDocs(repo: NovelRepository): Promise<DocRecord[]> {
  const out: DocRecord[] = [];
  for (const k of await repo.docs.keys('doc/')) {
    const d = await readData<DocRecord>(repo, k);
    if (d) out.push(d);
  }
  return out;
}

export async function createDoc(
  repo: NovelRepository,
  parentFolderId: string | null,
  init: { title?: string; blocks?: NoteBlock[] } = {},
  now = Date.now(),
): Promise<DocRecord> {
  const blocks = init.blocks ?? [];
  const named = init.title?.trim() ?? '';
  const doc: DocRecord = {
    id: newSlugId(),
    parentFolderId,
    title: named || fallbackTitle(blocks),
    ...(named ? {} : { autoTitle: true }),
    blocks,
    createdAt: now,
    updatedAt: now,
  };
  await repo.docs.write(docKey(doc.id), doc);
  repo.notifyChanged();
  return doc;
}

/**
 * Saves a document. `title: ''` (or an auto title) regenerates the fallback from the first six
 * words on every save, until the Author names it.
 */
export async function saveDoc(
  repo: NovelRepository,
  id: string,
  patch: Partial<Pick<DocRecord, 'title' | 'blocks' | 'parentFolderId'>>,
): Promise<DocRecord> {
  const d = await getDoc(repo, id);
  if (!d) throw new NotFoundError(`Document ${id}`);
  const blocks = patch.blocks ?? d.blocks;
  const named = patch.title !== undefined ? patch.title.trim() : d.autoTitle ? '' : d.title;
  const next: DocRecord = {
    id: d.id,
    parentFolderId: patch.parentFolderId !== undefined ? patch.parentFolderId : d.parentFolderId,
    createdAt: d.createdAt,
    blocks,
    title: named || fallbackTitle(blocks),
    ...(named ? {} : { autoTitle: true }),
    updatedAt: Date.now(),
  };
  await repo.docs.write(docKey(id), next);
  repo.notifyChanged();
  return next;
}

async function removeDocKeys(repo: NovelRepository, id: string): Promise<void> {
  await repo.docs.remove(docKey(id));
  for (const k of sidecarKeys(id)) await repo.docs.remove(k);
}

export async function deleteDoc(repo: NovelRepository, id: string): Promise<void> {
  await removeDocKeys(repo, id);
  repo.notifyChanged();
}
