// Single-book `.knbook`: the book's active subtree (anything in Trash, or under a trashed
// ancestor, stays behind) with its bodies, links, cover media and sidecar settings. Importing
// ADDS the book: when any id already exists in this workspace the whole book gets fresh ids, so
// an import never overwrites existing writing. Imported words get a day-0 growth baseline.
import { ulid, type MediaAssetRecord, type NodeRecord } from '@kn/core';
import type { DatabaseTables, NodeWrite, SettingRow } from '../db/port.ts';
import { thumbAssetId } from '../store/covers.ts';
import { newSlugId } from '../store/ids.ts';
import { countsOf } from '../store/growth-logger.ts';
import { recordBaseline, type GrowthCounts } from '../store/growth-store.ts';
import { parseBlocks } from '../store/node-mapping.ts';
import type { NovelRepository } from '../store/repository.ts';
import { nextPosition } from '../store/repository-writes.ts';
import { collectCovers, restoreCovers, type CoverMedia } from './archive-covers.ts';
import { buildArchive, parseArchive, type RestoreSummary } from './archive.ts';
import { emptyTables } from '../db/port.ts';
import { fail } from './archive-format.ts';

/** The ids a settings sidecar row belongs to (`meta/item/<id>`, `versions/<kind>:<id>`, ...). */
const SIDECAR = /^(?:meta\/(?:item|chapter-styles)\/([^/]+)|versions\/[a-z]+:([^/]+))$/;
export const sidecarOwner = (key: string): string | null => {
  const m = SIDECAR.exec(key);
  return m ? (m[1] ?? m[2] ?? null) : null;
};

/** Active (not trashed) subtree rooted at `rootId`, root first. */
function activeSubtree(nodes: readonly NodeRecord[], rootId: string): NodeRecord[] {
  const kids = new Map<string | null, NodeRecord[]>();
  for (const n of nodes) kids.set(n.parentId, [...(kids.get(n.parentId) ?? []), n]);
  const root = nodes.find((n) => n.id === rootId);
  if (!root || root.kind !== 'book' || root.deletedAt) return [];
  const out = [root];
  for (let i = 0; i < out.length; i++)
    for (const c of kids.get(out[i]!.id) ?? []) if (!c.deletedAt) out.push(c);
  return out;
}

export async function packNovel(
  repo: NovelRepository,
  novelId: string,
  now = Date.now(),
  media?: CoverMedia,
): Promise<Uint8Array> {
  const all = await repo.db.exportTables();
  const nodes = activeSubtree(all.nodes, novelId);
  if (nodes.length === 0) throw new Error('That book was not found.');
  const ids = new Set(nodes.map((n) => n.id));
  const wanted = new Set(
    nodes.flatMap((n) => (n.coverAssetId ? [n.coverAssetId, thumbAssetId(n.coverAssetId)] : [])),
  );
  const mediaAssets = all.mediaAssets.filter((a) => wanted.has(a.id));
  const tables: DatabaseTables = {
    ...emptyTables(),
    nodes,
    nodeBodies: all.nodeBodies.filter((b) => ids.has(b.nodeId)),
    nodeLinks: all.nodeLinks.filter((l) => ids.has(l.sourceId) && ids.has(l.targetId)),
    mediaAssets,
    settings: all.settings.filter((s) => ids.has(sidecarOwner(s.key) ?? '')),
  };
  const covers = media ? await collectCovers(repo, mediaAssets, media) : {};
  return buildArchive('knbook', tables, covers, now, nodes[0]!.title);
}

/** Exactly one root book; every other node sits below it. Returns the book. */
function checkBook(t: DatabaseTables): NodeRecord {
  const books = t.nodes.filter((n) => n.parentId === null);
  const book = books[0];
  if (books.length !== 1 || book?.kind !== 'book')
    return fail('A .knbook must contain exactly one book.');
  const ids = new Set(t.nodes.map((n) => n.id));
  if (t.nodes.some((n) => n.deletedAt || (n.parentId !== null && !ids.has(n.parentId))))
    return fail('The book file is inconsistent.');
  return book;
}

/** Fresh ids for the whole book when any of its ids is already taken; otherwise identity. */
async function idMapper(repo: NovelRepository, t: DatabaseTables) {
  const nodeIds = new Set((await repo.db.listNodes({ includeDeleted: true })).map((n) => n.id));
  const mediaIds = new Set((await repo.db.listMediaAssets()).map((a) => a.id));
  const clash =
    t.nodes.some((n) => nodeIds.has(n.id)) || t.mediaAssets.some((a) => mediaIds.has(a.id));
  const nodes = new Map<string, string>();
  const assets = new Map<string, string>();
  const node = (id: string): string => {
    if (!clash) return id;
    if (!nodes.has(id)) nodes.set(id, newSlugId());
    return nodes.get(id)!;
  };
  const asset = (id: string): string => {
    if (!clash) return id;
    if (!assets.has(id))
      assets.set(id, id.endsWith('-thumb') ? thumbAssetId(asset(id.slice(0, -6))) : ulid());
    return assets.get(id)!;
  };
  return { node, asset };
}

const sidecarKey = (key: string, owner: string, to: string): string =>
  `${key.slice(0, key.length - owner.length)}${to}`;

export async function restoreNovel(
  repo: NovelRepository,
  bytes: Uint8Array,
  media?: CoverMedia,
): Promise<RestoreSummary> {
  const { tables, covers } = await parseArchive(bytes, 'knbook');
  const book = checkBook(tables);
  const db = repo.db;
  const map = await idMapper(repo, tables);
  const known = new Set(tables.mediaAssets.map((a) => a.id));
  const assets: MediaAssetRecord[] = (
    await restoreCovers(repo, covers, tables.mediaAssets, media)
  ).map((a) => ({ ...a, id: map.asset(a.id) }));
  const bodies = new Map(tables.nodeBodies.map((b) => [b.nodeId, b]));
  const ownIds = new Set(tables.nodes.map((n) => n.id));
  const rootPosition = await nextPosition(db, null);
  const writes: NodeWrite[] = tables.nodes.map((n) => {
    const body = bodies.get(n.id);
    const links = tables.nodeLinks
      .filter((l) => l.sourceId === n.id)
      .map((l) => ({ ...l, sourceId: map.node(l.sourceId), targetId: map.node(l.targetId) }));
    return {
      node: {
        ...n,
        id: map.node(n.id),
        parentId: n.parentId === null ? null : map.node(n.parentId),
        bookId: n.bookId === null ? null : map.node(n.bookId),
        coverAssetId:
          n.coverAssetId && known.has(n.coverAssetId) ? map.asset(n.coverAssetId) : null,
        position: n.id === book.id ? rootPosition : n.position,
      },
      ...(body ? { body: { ...body, nodeId: map.node(n.id) } } : {}),
      links,
    };
  });
  const sidecars: SettingRow[] = [];
  for (const s of tables.settings) {
    const owner = sidecarOwner(s.key);
    if (owner && ownIds.has(owner))
      sidecars.push({ ...s, key: sidecarKey(s.key, owner, map.node(owner)) });
  }
  await db.putMediaAssets(assets);
  try {
    await db.putNodes(writes);
  } catch (err) {
    await db.deleteMediaAssets(assets.map((a) => a.id));
    throw err;
  }
  for (const s of sidecars) await db.setSetting(s.key, s.valueJson);
  await writeBaselines(repo, writes, map.node(book.id));
  repo.notifyChanged();
  return { kind: 'knbook', keys: writes.length, title: book.title };
}

/** Day-0 growth baselines: imported words must not count as written today. */
async function writeBaselines(
  repo: NovelRepository,
  writes: NodeWrite[],
  bookId: string,
): Promise<void> {
  const total: GrowthCounts = { chars: 0, words: 0, sentences: 0, paragraphs: 0 };
  const entries: { nodeId: string; counts: GrowthCounts }[] = [];
  for (const w of writes) {
    if (w.node.kind !== 'chapter') continue;
    const counts = countsOf({ blocks: parseBlocks(w.body ?? null) });
    entries.push({ nodeId: w.node.id, counts });
    for (const k of Object.keys(total) as (keyof GrowthCounts)[]) total[k] += counts[k];
  }
  await recordBaseline(repo, [...entries, { nodeId: bookId, counts: total }]);
}
