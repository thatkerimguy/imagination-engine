// Cover art in the v2 schema: each picked cover is a `media_assets` row (kind `cover`) plus its
// `cover_thumb` sibling (`<coverAssetId>-thumb`), referenced by `nodes.cover_asset_id`. Paths
// are stored relative to the document directory and resolved against `repo.mediaRoot`.
import { ulid, type MediaAssetRecord, type NodeRecord } from '@kn/core';
import type { CoverFile, PickedCover } from '../media/cover-types.ts';
import { NotFoundError } from './errors.ts';
import type { NovelRepository } from './repository.ts';

export const thumbAssetId = (coverAssetId: string): string => `${coverAssetId}-thumb`;

const ABSOLUTE = /^[a-z][a-z0-9+.-]*:/i;

/** A stored relative path (or a data / file URI kept as-is) → a loadable URI. */
export function resolveMediaUri(repo: Pick<NovelRepository, 'mediaRoot'>, path: string): string {
  if (ABSOLUTE.test(path) || !repo.mediaRoot) return path;
  return `${repo.mediaRoot.replace(/\/?$/, '/')}${path.replace(/^\/+/, '')}`;
}

/** A URI inside the document directory → its relative path; anything else is kept whole. */
export function toRelativePath(repo: Pick<NovelRepository, 'mediaRoot'>, uri: string): string {
  const root = repo.mediaRoot.replace(/\/?$/, '/');
  return repo.mediaRoot && uri.startsWith(root) ? uri.slice(root.length) : uri;
}

function asset(
  repo: NovelRepository,
  id: string,
  kind: MediaAssetRecord['kind'],
  f: CoverFile,
): MediaAssetRecord {
  return {
    id,
    kind,
    relativePath: toRelativePath(repo, f.uri),
    mimeType: f.mimeType,
    width: f.width,
    height: f.height,
    bytes: f.bytes,
    createdAt: repo.nowIso(),
  };
}

/** The node's cover URI, when it has one. */
export async function coverUriOf(
  repo: NovelRepository,
  node: Pick<NodeRecord, 'coverAssetId'>,
): Promise<string | undefined> {
  if (!node.coverAssetId) return undefined;
  const a = await repo.db.getMediaAsset(node.coverAssetId);
  return a ? resolveMediaUri(repo, a.relativePath) : undefined;
}

/** Cover URI per node id, for every node that has one (one asset scan). */
export async function allCoverUris(repo: NovelRepository): Promise<Map<string, string>> {
  const assets = new Map((await repo.db.listMediaAssets()).map((a) => [a.id, a]));
  const out = new Map<string, string>();
  for (const n of await repo.db.listNodes({ includeDeleted: true })) {
    const a = n.coverAssetId ? assets.get(n.coverAssetId) : undefined;
    if (a) out.set(n.id, resolveMediaUri(repo, a.relativePath));
  }
  return out;
}

/**
 * Deletes media rows no node references any more (a cover's thumbnail goes with it). Returns
 * their resolved URIs so the caller can delete the files (media/cover-files.ts).
 */
export async function releaseUnusedMedia(repo: NovelRepository): Promise<string[]> {
  const used = new Set<string>();
  for (const n of await repo.db.listNodes({ includeDeleted: true }))
    if (n.coverAssetId) used.add(n.coverAssetId).add(thumbAssetId(n.coverAssetId));
  const assets = await repo.db.listMediaAssets();
  const unused = assets.filter((a) => !used.has(a.id));
  await repo.db.deleteMediaAssets(unused.map((a) => a.id));
  // A file another live asset still points at (the same cover on two items) is kept.
  const live = new Set(assets.filter((a) => used.has(a.id)).map((a) => a.relativePath));
  const files = unused.filter((a) => a.kind === 'cover' && !live.has(a.relativePath));
  return [...new Set(files.map((a) => resolveMediaUri(repo, a.relativePath)))];
}

/**
 * Registers a picked cover (+ thumbnail) in `media_assets` and points the item at it. The
 * replaced cover's rows are released; returns the new cover URI and the now-unused file URIs.
 */
export async function setItemCover(
  repo: NovelRepository,
  itemId: string,
  picked: PickedCover,
): Promise<{ uri: string; unusedUris: string[] }> {
  const node = await repo.db.getNode(itemId);
  if (!node) throw new NotFoundError(`Item ${itemId}`);
  const id = ulid(repo.now());
  const rows = [asset(repo, id, 'cover', picked.cover)];
  if (picked.thumb) rows.push(asset(repo, thumbAssetId(id), 'cover_thumb', picked.thumb));
  await repo.db.putMediaAssets(rows);
  await repo.db.putNodes([{ node: { ...node, coverAssetId: id, updatedAt: repo.nowIso() } }]);
  const unusedUris = await releaseUnusedMedia(repo);
  repo.notifyChanged();
  return { uri: resolveMediaUri(repo, rows[0]!.relativePath), unusedUris };
}

/** Removes an item's cover. Returns the now-unused file URIs. */
export async function clearItemCover(repo: NovelRepository, itemId: string): Promise<string[]> {
  const node = await repo.db.getNode(itemId);
  if (!node?.coverAssetId) return [];
  await repo.db.putNodes([{ node: { ...node, coverAssetId: null, updatedAt: repo.nowIso() } }]);
  const unused = await releaseUnusedMedia(repo);
  repo.notifyChanged();
  return unused;
}

/** A cover known only by URI (legacy callers, backups): registered with unknown dimensions. */
export function coverFromUri(uri: string): PickedCover {
  const mimeType = /^data:([^;,]+)/.exec(uri)?.[1] ?? 'image/jpeg';
  return { cover: { uri, width: 0, height: 0, bytes: 0, mimeType }, thumb: null };
}
