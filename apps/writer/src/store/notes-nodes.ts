// Notes workspace on the v2 node tree: endlessly nested `folder` nodes and standalone `note`
// nodes (bookId null). Writer-only, never published. Notes keep the Author's source text (writer
// markup included) in `node_bodies`; promoting one to a chapter sanitizes it into a valid
// ChapterDocument. Saving a note refreshes its search text and its @mention links.
import type { DialogueBlock, NodeRecord, ProseBlock, SceneBreakBlock } from '@kn/core';
import { isStoryKind, STORY_KINDS, type StoryKind } from '../notes/kind-meta.ts';
import { kindMeta, ms, parseBlocks } from './node-mapping.ts';
import type { NovelRepository } from './repository.ts';
import { hiddenNoteIds } from './trash-model.ts';

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
  /** Story Bible kind: a plain note, character, location or lore entry. */
  kind: StoryKind;
  blocks: NoteBlock[];
  /** True while the title is generated from the first words (the Author never named it). */
  autoTitle?: boolean;
}

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

export const toFolder = (n: NodeRecord): FolderRecord => ({
  id: n.id,
  parentFolderId: n.parentId,
  title: n.title,
  createdAt: ms(n.createdAt),
  updatedAt: ms(n.updatedAt),
});

export async function toDoc(repo: NovelRepository, n: NodeRecord): Promise<DocRecord> {
  const auto = kindMeta<{ autoTitle: boolean }>(n.metaJson).autoTitle === true;
  return {
    ...toFolder(n),
    kind: isStoryKind(n.kind) ? n.kind : 'note',
    blocks: parseBlocks<NoteBlock>(await repo.db.getBody(n.id)),
    ...(auto ? { autoTitle: true } : {}),
  };
}

/** `'note'` means any document kind (note, character, location, lore). */
export async function nodeOf(repo: NovelRepository, id: string, kind: 'folder' | 'note') {
  const n = await repo.db.getNode(id);
  if (!n) return null;
  return (kind === 'folder' ? n.kind === 'folder' : isStoryKind(n.kind)) ? n : null;
}

export function folderNode(
  id: string,
  parentId: string | null,
  title: string,
  position: number,
  now: string,
): NodeRecord {
  return {
    id,
    kind: 'folder',
    parentId,
    bookId: null,
    title,
    subtitle: null,
    position,
    workspaceMode: null,
    coverAssetId: null,
    locked: false,
    deletedAt: null,
    wordCount: 0,
    createdAt: now,
    updatedAt: now,
    metaJson: null,
  };
}

export const scanNodes = (repo: NovelRepository, kind: 'folder' | 'note') =>
  repo.db.listNodes({
    kinds: kind === 'folder' ? ['folder'] : [...STORY_KINDS],
    includeDeleted: true,
  });

/** Every stored folder / note, trashed ones included (Trash, Doctor, permanent deletes). */
export const scanFolders = async (repo: NovelRepository): Promise<FolderRecord[]> =>
  (await scanNodes(repo, 'folder')).map(toFolder);

/** Folder and note nodes in the active workspace: not trashed, not inside a trashed folder. */
export async function activeNodes(repo: NovelRepository) {
  const [folders, notes] = await Promise.all([scanNodes(repo, 'folder'), scanNodes(repo, 'note')]);
  const trashed = new Set([...folders, ...notes].filter((n) => n.deletedAt).map((n) => n.id));
  const nodeRef = (n: NodeRecord) => ({ id: n.id, parentFolderId: n.parentId });
  const hidden = hiddenNoteIds(folders.map(nodeRef), notes.map(nodeRef), trashed);
  return {
    folders: folders.filter((f) => !hidden.has(f.id)),
    notes: notes.filter((d) => !hidden.has(d.id)),
  };
}
