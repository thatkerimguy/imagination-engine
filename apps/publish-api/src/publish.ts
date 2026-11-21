// Publish / unpublish lifecycle. All validation happens first (publish-validate.ts); only then do
// we write, and finally sweep every stale key under the novel's prefix.
import type { ObjectStore } from './store.ts';
import type { PublishResponse, UnpublishResponse } from './protocol.ts';
import { PublishError, coverExtension, validateBook } from './publish-validate.ts';
import { isSlugId } from './protocol.ts';

export { PublishError };

const JSON_TYPE = 'application/json; charset=utf-8';
const INDEX_KEY = 'novels/index.json';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const putJson = (store: ObjectStore, key: string, value: unknown): Promise<void> =>
  store.put(key, encoder.encode(JSON.stringify(value)), JSON_TYPE);

async function readIndex(store: ObjectStore): Promise<string[]> {
  const obj = await store.get(INDEX_KEY);
  if (!obj) return [];
  try {
    const parsed: unknown = JSON.parse(decoder.decode(obj.body));
    if (typeof parsed !== 'object' || parsed === null) return [];
    const list = (parsed as { novels?: unknown }).novels;
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function setListed(store: ObjectStore, novelId: string, listed: boolean): Promise<void> {
  const ids = await readIndex(store);
  const has = ids.includes(novelId);
  if (has === listed) return;
  const next = listed ? [...ids, novelId] : ids.filter((id) => id !== novelId);
  await putJson(store, INDEX_KEY, { novels: next });
}

async function sweep(store: ObjectStore, novelId: string, keep: Set<string>): Promise<number> {
  const keys = await store.list(`novels/${novelId}/`);
  let removed = 0;
  for (const key of keys) {
    if (keep.has(key)) continue;
    await store.delete(key);
    removed++;
  }
  return removed;
}

export async function publishNovel(
  store: ObjectStore,
  novelId: string,
  body: unknown,
  now: Date,
): Promise<PublishResponse> {
  const book = validateBook(novelId, body);
  const base = `novels/${novelId}`;
  const keep = new Set<string>();
  let published = 0;
  let unlisted = 0;
  let drafts = 0;

  const publishedSeasonIds = new Set<string>();
  const unlistedSeasonIds = new Set<string>();
  const writes: Array<() => Promise<void>> = [];
  for (const { season, chapters } of book.seasons) {
    const listed: string[] = [];
    let kept = 0;
    for (const chapter of chapters) {
      if (chapter.status === 'draft') {
        drafts++;
        continue;
      }
      kept++;
      const key = `${base}/seasons/${season.id}/${chapter.id}.json`;
      keep.add(key);
      writes.push(() => putJson(store, key, chapter));
      if (chapter.status === 'published') {
        published++;
        listed.push(chapter.id);
        publishedSeasonIds.add(season.id);
      } else {
        unlisted++;
        unlistedSeasonIds.add(season.id);
      }
    }
    if (kept === 0) continue;
    const key = `${base}/seasons/${season.id}/season.json`;
    keep.add(key);
    writes.push(() => putJson(store, key, { ...season, chapters: listed }));
  }

  if (published + unlisted === 0) {
    const removedKeys = await sweep(store, novelId, keep);
    await setListed(store, novelId, false);
    return response(novelId, 0, 0, drafts, removedKeys, now, false);
  }

  const visible = publishedSeasonIds.size > 0 ? publishedSeasonIds : unlistedSeasonIds;
  const novelDoc: Record<string, unknown> = {
    ...book.novel,
    seasons: book.novel.seasons.filter((id) => visible.has(id)),
  };
  if (book.cover) {
    const name = `cover.${coverExtension(book.cover.mime)}`;
    const bytes = book.cover.bytes;
    const mime = book.cover.mime;
    novelDoc.cover = name;
    keep.add(`${base}/${name}`);
    writes.push(() => store.put(`${base}/${name}`, bytes, mime));
  }
  keep.add(`${base}/novel.json`);
  writes.push(() => putJson(store, `${base}/novel.json`, novelDoc));

  for (const write of writes) await write();
  const removedKeys = await sweep(store, novelId, keep);
  const publicListed = published > 0;
  await setListed(store, novelId, publicListed);
  return response(novelId, published, unlisted, drafts, removedKeys, now, publicListed);
}

function response(
  novelId: string,
  publishedChapters: number,
  unlistedChapters: number,
  skippedDrafts: number,
  removedKeys: number,
  now: Date,
  publicListed: boolean,
): PublishResponse {
  return {
    ok: true,
    novelId,
    publishedChapters,
    unlistedChapters,
    skippedDrafts,
    removedKeys,
    publishedAt: now.toISOString(),
    publicListed,
  };
}

export async function unpublishNovel(
  store: ObjectStore,
  novelId: string,
): Promise<UnpublishResponse> {
  if (!isSlugId(novelId)) throw new PublishError(400, 'Invalid novel id');
  const removedKeys = await sweep(store, novelId, new Set());
  await setListed(store, novelId, false);
  return { ok: true, novelId, removedKeys };
}
