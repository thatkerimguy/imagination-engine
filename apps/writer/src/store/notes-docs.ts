// Notes workspace documents (`note`, `character`, `location` and `lore` nodes): source text with writer markup in `node_bodies`;
// every save refreshes the search text and the note's @mention links.
import type { NodeRecord } from '@kn/core';
import type { StoryKind } from '../notes/kind-meta.ts';
import { NotFoundError } from './errors.ts';
import { newSlugId } from './ids.ts';
import { plainTextOf } from './node-mapping.ts';
import {
  activeNodes,
  fallbackTitle,
  folderNode,
  nodeOf,
  toDoc,
  type DocRecord,
  type NoteBlock,
} from './notes-nodes.ts';
import type { NovelRepository } from './repository.ts';
import { mentionLinks, nextPosition } from './repository-writes.ts';
import { chapterWords } from './word-count.ts';

// ── Documents (note nodes) ────────────────────────────────────────────────────────────────

export async function getDoc(repo: NovelRepository, id: string): Promise<DocRecord | null> {
  const n = await nodeOf(repo, id, 'note');
  return n ? toDoc(repo, n) : null;
}

export async function listAllDocs(repo: NovelRepository): Promise<DocRecord[]> {
  const out: DocRecord[] = [];
  for (const n of (await activeNodes(repo)).notes) out.push(await toDoc(repo, n));
  return out;
}

async function writeDoc(repo: NovelRepository, d: DocRecord, position: number, createdAt: string) {
  const now = new Date(d.updatedAt).toISOString();
  const prev = await repo.db.getNode(d.id);
  const plainText = plainTextOf(d.blocks);
  const node: NodeRecord = {
    ...folderNode(d.id, d.parentFolderId, d.title, position, createdAt),
    kind: d.kind,
    coverAssetId: prev?.coverAssetId ?? null,
    locked: prev?.locked ?? false,
    deletedAt: prev?.deletedAt ?? null,
    wordCount: chapterWords({
      id: d.id,
      seasonId: '',
      title: '',
      status: 'draft',
      blocks: d.blocks,
    }),
    updatedAt: now,
    metaJson: d.autoTitle ? JSON.stringify({ autoTitle: true }) : null,
  };
  const body = { nodeId: d.id, blocksJson: JSON.stringify(d.blocks), plainText, updatedAt: now };
  await repo.db.putNodes([
    { node, body, links: await mentionLinks(repo.db, d.id, plainText, now) },
  ]);
}

export async function createDoc(
  repo: NovelRepository,
  parentFolderId: string | null,
  init: { title?: string; blocks?: NoteBlock[]; kind?: StoryKind } = {},
  now = Date.now(),
): Promise<DocRecord> {
  const blocks = init.blocks ?? [];
  const named = init.title?.trim() ?? '';
  const doc: DocRecord = {
    id: newSlugId(),
    kind: init.kind ?? 'note',
    parentFolderId,
    title: named || fallbackTitle(blocks),
    ...(named ? {} : { autoTitle: true }),
    blocks,
    createdAt: now,
    updatedAt: now,
  };
  const position = await nextPosition(repo.db, parentFolderId);
  await writeDoc(repo, doc, position, new Date(now).toISOString());
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
  const n = await nodeOf(repo, id, 'note');
  if (!n) throw new NotFoundError(`Document ${id}`);
  const d = await toDoc(repo, n);
  const blocks = patch.blocks ?? d.blocks;
  const named = patch.title !== undefined ? patch.title.trim() : d.autoTitle ? '' : d.title;
  const parentFolderId =
    patch.parentFolderId !== undefined ? patch.parentFolderId : d.parentFolderId;
  const next: DocRecord = {
    id: d.id,
    kind: d.kind,
    parentFolderId,
    createdAt: d.createdAt,
    blocks,
    title: named || fallbackTitle(blocks),
    ...(named ? {} : { autoTitle: true }),
    updatedAt: Date.now(),
  };
  const moved = parentFolderId !== n.parentId;
  const position = moved ? await nextPosition(repo.db, parentFolderId) : n.position;
  await writeDoc(repo, next, position, n.createdAt);
  repo.notifyChanged();
  return next;
}
