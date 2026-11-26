// Relational 30-day Trash: move to Trash (`deleted_at`), list, restore, delete forever, empty and
// auto-purge. Model and pure helpers live in trash-model.ts. Permanent deletion removes the node
// row and lets ON DELETE CASCADE wipe descendants, bodies, links and growth logs; settings-table
// sidecars of every removed id go too. Returns now-unused cover URIs so the caller can delete the
// files (media/cover-files.ts).
import type { NodeRecord } from '@kn/core';
import { isStoryKind } from '../notes/kind-meta.ts';
import { countsOf } from './growth-logger.ts';
import { recordBaseline } from './growth-store.ts';
import { releaseUnusedMedia } from './covers.ts';
import { NotFoundError, ValidationError } from './errors.ts';
import { itemMetaKey } from './item-meta.ts';
import { parseBlocks } from './node-mapping.ts';
import type { NovelRepository } from './repository.ts';
import {
  isTrashExpired,
  trashDaysLeft,
  trashRecordOf,
  type TrashListItem,
  type TrashRecord,
} from './trash-model.ts';

export * from './trash-model.ts';

export type TrashTarget =
  | { kind: 'novel'; novelId: string }
  | { kind: 'season'; novelId: string; seasonId: string }
  | { kind: 'chapter'; novelId: string; seasonId: string; chapterId: string }
  | { kind: 'folder' | 'doc'; id: string };

const KIND = {
  novel: 'book',
  season: 'season',
  chapter: 'chapter',
  folder: 'folder',
  doc: 'note',
} as const;

const targetId = (t: TrashTarget): string =>
  t.kind === 'novel'
    ? t.novelId
    : t.kind === 'season'
      ? t.seasonId
      : t.kind === 'chapter'
        ? t.chapterId
        : t.id;

/** Every trashed node as a Trash record. */
export async function loadTrashRecords(repo: NovelRepository): Promise<TrashRecord[]> {
  const out: TrashRecord[] = [];
  for (const n of await repo.db.listNodes({ includeDeleted: true })) {
    const r = trashRecordOf(n);
    if (r) out.push(r);
  }
  return out;
}

const iso = (now: number): string => new Date(now).toISOString();

/** Soft-deletes an item: it disappears from every active list but stays restorable for 30 days. */
export async function moveToTrash(
  repo: NovelRepository,
  t: TrashTarget,
  now = Date.now(),
): Promise<TrashRecord> {
  const node = await repo.db.getNode(targetId(t));
  const okKind = t.kind === 'doc' ? isStoryKind(node?.kind) : node?.kind === KIND[t.kind];
  if (!node || !okKind) throw new NotFoundError(`${t.kind} ${targetId(t)}`);
  if (t.kind === 'season' && (await repo.children(t.novelId, 'season')).length <= 1)
    throw new ValidationError('Season', ['A book needs at least one season']);
  const trashed: NodeRecord = { ...node, deletedAt: iso(now) };
  await repo.db.putNodes([{ node: trashed }]);
  repo.notifyChanged();
  return trashRecordOf(trashed)!;
}

/** Everything in Trash, newest first, with the days left before automatic deletion. */
export async function listTrashedItems(
  repo: NovelRepository,
  now = Date.now(),
): Promise<TrashListItem[]> {
  return (await loadTrashRecords(repo))
    .map((r) => ({ ...r, daysLeft: trashDaysLeft(r, now) }))
    .sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt));
}

/** The node and every descendant (cycle-safe), from one node scan. */
async function subtree(repo: NovelRepository, id: string): Promise<NodeRecord[]> {
  const all = await repo.db.listNodes({ includeDeleted: true });
  const inside = new Set([id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const n of all)
      if (n.parentId && inside.has(n.parentId) && !inside.has(n.id)) {
        inside.add(n.id);
        grew = true;
      }
  }
  return all.filter((n) => inside.has(n.id));
}

/**
 * Brings an item back where it was (its `position` was kept). Trashed ancestors (its book,
 * season or parent folders) come back with it. Restored chapters get a day-0 growth baseline so
 * their existing words never count as written today.
 */
export async function restoreTrashedItem(repo: NovelRepository, id: string): Promise<void> {
  const node = await repo.db.getNode(id);
  if (!node || !trashRecordOf(node)) throw new NotFoundError(`Trash item ${id}`);
  const writes: NodeRecord[] = [{ ...node, deletedAt: null }];
  const seen = new Set([id]);
  for (let at = node.parentId; at && !seen.has(at);) {
    seen.add(at);
    const p = await repo.db.getNode(at);
    if (!p) break;
    if (p.deletedAt) writes.push({ ...p, deletedAt: null });
    at = p.parentId;
  }
  await repo.db.putNodes(writes.map((n) => ({ node: n })));
  const chapters = (await subtree(repo, id)).filter((n) => n.kind === 'chapter');
  const entries = [];
  for (const c of chapters)
    entries.push({
      nodeId: c.id,
      counts: countsOf({ blocks: parseBlocks(await repo.db.getBody(c.id)) }),
    });
  await recordBaseline(repo, entries);
  repo.notifyChanged();
}

const SIDECAR_KINDS = ['chapter', 'novel', 'doc', 'folder'] as const;

/** Every settings-table sidecar an id can own (meta, styles, publish status, versions). */
export const sidecarKeysOf = (id: string): string[] => [
  itemMetaKey(id),
  `meta/chapter-styles/${id}`,
  `meta/publish/${id}`,
  ...SIDECAR_KINDS.map((k) => `versions/${k}:${id}`),
];

/** Deletes a trashed item and everything inside it for good. Returns now-unused cover URIs. */
export async function permanentlyDeleteItem(repo: NovelRepository, id: string): Promise<string[]> {
  const node = await repo.db.getNode(id);
  if (!node?.deletedAt) return [];
  const ids = (await subtree(repo, id)).map((n) => n.id);
  await repo.db.deleteNodes([id]);
  for (const i of ids) for (const k of sidecarKeysOf(i)) await repo.docs.remove(k);
  const covers = await releaseUnusedMedia(repo);
  repo.notifyChanged();
  return covers;
}

async function deleteWhere(
  repo: NovelRepository,
  pick: (r: TrashRecord) => boolean,
): Promise<string[]> {
  const covers: string[] = [];
  for (const r of await loadTrashRecords(repo))
    if (pick(r) && (await repo.db.getNode(r.id)))
      covers.push(...(await permanentlyDeleteItem(repo, r.id)));
  return covers;
}

/** Deletes everything in Trash for good. Returns now-unused cover URIs. */
export const emptyTrash = (repo: NovelRepository): Promise<string[]> =>
  deleteWhere(repo, () => true);

/** Deletes items trashed 30+ days ago. Safe to run on every launch. Returns unused cover URIs. */
export const purgeExpiredTrash = (repo: NovelRepository, now = Date.now()): Promise<string[]> =>
  deleteWhere(repo, (r) => isTrashExpired(r, now));
