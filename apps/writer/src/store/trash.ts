// 30-day Trash operations: move to Trash, list, restore, delete forever, empty and auto-purge.
// Model and pure helpers live in trash-model.ts. Permanent deletions return the cover image URIs
// nothing references any more, so the caller can delete those files (media/cover-files.ts).
import type { DocumentStore } from './documents.ts';
import { keys } from './documents.ts';
import { NotFoundError, ValidationError } from './errors.ts';
import { getDoc, getFolder, saveDoc, scanDocs, scanFolders } from './folders.ts';
import { itemMetaKey, loadAllItemMeta } from './item-meta.ts';
import type { NovelRepository } from './repository.ts';
import {
  insertAt,
  isTrashExpired,
  normalizeTrashRecord,
  TRASH_PREFIX,
  trashDaysLeft,
  trashKey,
  type TrashListItem,
  type TrashRecord,
} from './trash-model.ts';

export * from './trash-model.ts';

export type TrashTarget =
  | { kind: 'novel'; novelId: string }
  | { kind: 'season'; novelId: string; seasonId: string }
  | { kind: 'chapter'; novelId: string; seasonId: string; chapterId: string }
  | { kind: 'folder' | 'doc'; id: string };

export async function loadTrashRecords(docs: DocumentStore): Promise<TrashRecord[]> {
  const out: TrashRecord[] = [];
  for (const k of await docs.keys(TRASH_PREFIX)) {
    const r = normalizeTrashRecord((await docs.read<unknown>(k))?.data);
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
  let r: TrashRecord;
  if (t.kind === 'novel') {
    const novel = await repo.requireNovel(t.novelId);
    r = { id: novel.id, kind: 'novel', title: novel.title, deletedAt: iso(now) };
  } else if (t.kind === 'season') {
    const novel = await repo.requireNovel(t.novelId);
    const season = await repo.getSeason(t.novelId, t.seasonId);
    if (!season) throw new NotFoundError(`Season ${t.seasonId}`);
    const rest = novel.seasons.filter((s) => s !== t.seasonId);
    if (rest.length === 0)
      throw new ValidationError('Season', ['A book needs at least one season']);
    const index = novel.seasons.indexOf(t.seasonId);
    r = { id: season.id, kind: 'season', title: season.title, deletedAt: iso(now) };
    Object.assign(r, { novelId: t.novelId, ...(index >= 0 ? { index } : {}) });
    await repo.saveNovel({ ...novel, seasons: rest });
  } else if (t.kind === 'chapter') {
    const season = await repo.getSeason(t.novelId, t.seasonId);
    const chapter = await repo.getChapter(t.novelId, t.seasonId, t.chapterId);
    if (!season || !chapter) throw new NotFoundError(`Chapter ${t.chapterId}`);
    const index = season.chapters.indexOf(t.chapterId);
    r = { id: chapter.id, kind: 'chapter', title: chapter.title, deletedAt: iso(now) };
    Object.assign(r, { novelId: t.novelId, seasonId: t.seasonId });
    if (index >= 0) r.index = index;
    const chapters = season.chapters.filter((c) => c !== t.chapterId);
    await repo.saveSeason(t.novelId, { ...season, chapters });
  } else {
    const item = t.kind === 'folder' ? await getFolder(repo, t.id) : await getDoc(repo, t.id);
    if (!item) throw new NotFoundError(`${t.kind} ${t.id}`);
    r = { id: item.id, kind: t.kind, title: item.title, deletedAt: iso(now) };
  }
  await repo.docs.write(trashKey(r.id), r);
  repo.notifyChanged();
  return r;
}

/** Everything in Trash, newest first, with the days left before automatic deletion. */
export async function listTrashedItems(
  repo: NovelRepository,
  now = Date.now(),
): Promise<TrashListItem[]> {
  return (await loadTrashRecords(repo.docs))
    .map((r) => ({ ...r, daysLeft: trashDaysLeft(r, now) }))
    .sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt));
}

async function readRecord(repo: NovelRepository, id: string): Promise<TrashRecord | null> {
  return normalizeTrashRecord((await repo.docs.read<unknown>(trashKey(id)))?.data);
}

/**
 * Brings an item back where it was. Trashed ancestors (its book, season or parent folders) come
 * back with it; a parent folder that no longer exists puts the note at the Notes root.
 */
export async function restoreTrashedItem(repo: NovelRepository, id: string): Promise<void> {
  const r = await readRecord(repo, id);
  if (!r) throw new NotFoundError(`Trash item ${id}`);
  const unmark = (x: string): Promise<void> => repo.docs.remove(trashKey(x));
  if (r.kind === 'season' || r.kind === 'chapter') {
    const novelId = r.novelId ?? '';
    await unmark(novelId);
    if (r.kind === 'season') {
      const novel = await repo.requireNovel(novelId);
      await repo.saveNovel({ ...novel, seasons: insertAt(novel.seasons, r.id, r.index) });
    } else {
      const seasonId = r.seasonId ?? '';
      if (await readRecord(repo, seasonId)) await restoreTrashedItem(repo, seasonId);
      const season = await repo.getSeason(novelId, seasonId);
      if (!season) throw new NotFoundError(`Season ${seasonId}`);
      const chapters = insertAt(season.chapters, r.id, r.index);
      await repo.saveSeason(novelId, { ...season, chapters });
    }
  } else if (r.kind === 'folder' || r.kind === 'doc') {
    const item = r.kind === 'folder' ? await getFolder(repo, r.id) : await getDoc(repo, r.id);
    if (!item) throw new NotFoundError(`${r.kind} ${r.id}`);
    let parent = item.parentFolderId;
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      await unmark(parent);
      const f = await getFolder(repo, parent);
      if (!f) {
        if (r.kind === 'doc') await saveDoc(repo, r.id, { parentFolderId: null });
        else await repo.docs.write(`folder/${r.id}`, { ...item, parentFolderId: null });
        break;
      }
      parent = f.parentFolderId;
    }
  }
  await unmark(r.id);
  repo.notifyChanged();
}

/** Storage keys of one item and everything inside it, plus the ids whose sidecars go too. */
async function footprint(repo: NovelRepository, r: TrashRecord) {
  const ids = [r.id];
  const dataKeys: string[] = [];
  if (r.kind === 'novel' || r.kind === 'season') {
    const n = r.kind === 'novel' ? r.id : (r.novelId ?? '');
    const chapterPrefix = r.kind === 'novel' ? keys.chaptersOf(n) : keys.chaptersOf(n, r.id);
    if (r.kind === 'novel')
      dataKeys.push(keys.novel(n), ...(await repo.docs.keys(keys.seasonsOf(n))));
    else dataKeys.push(keys.season(n, r.id));
    for (const k of await repo.docs.keys(chapterPrefix)) {
      dataKeys.push(k);
      ids.push(k.slice(k.lastIndexOf('/') + 1));
    }
    for (const k of dataKeys)
      if (k.startsWith('season/')) ids.push(k.slice(k.lastIndexOf('/') + 1));
  } else if (r.kind === 'chapter') {
    dataKeys.push(keys.chapter(r.novelId ?? '', r.seasonId ?? '', r.id));
  } else if (r.kind === 'doc') {
    dataKeys.push(`doc/${r.id}`);
  } else {
    const folders = await scanFolders(repo);
    const inside = new Set([r.id]);
    for (let grew = true; grew;) {
      grew = false;
      for (const f of folders)
        if (f.parentFolderId && inside.has(f.parentFolderId) && !inside.has(f.id)) {
          inside.add(f.id);
          grew = true;
        }
    }
    for (const f of inside) dataKeys.push(`folder/${f}`);
    for (const d of await scanDocs(repo))
      if (d.parentFolderId && inside.has(d.parentFolderId)) {
        dataKeys.push(`doc/${d.id}`);
        ids.push(d.id);
      }
    ids.push(...[...inside].filter((f) => f !== r.id));
  }
  return { ids: [...new Set(ids)], dataKeys };
}

const SIDECAR_KINDS = ['chapter', 'novel', 'doc', 'folder'] as const;

/** Every per-item sidecar an id can own (meta, styles, publish status, versions, growth, trash). */
export const sidecarKeysOf = (id: string): string[] => [
  itemMetaKey(id),
  `meta/chapter-styles/${id}`,
  `meta/publish/${id}`,
  ...SIDECAR_KINDS.flatMap((k) => [`versions/${k}:${id}`, `growth/${k}:${id}`]),
  trashKey(id),
];

/** Deletes a trashed item and everything inside it for good. Returns now-unused cover URIs. */
export async function permanentlyDeleteItem(repo: NovelRepository, id: string): Promise<string[]> {
  const r = await readRecord(repo, id);
  if (!r) return [];
  const { ids, dataKeys } = await footprint(repo, r);
  const meta = await loadAllItemMeta(repo);
  const gone = new Set(ids);
  const covers = new Set(ids.map((i) => meta.get(i)?.coverUri).filter((u): u is string => !!u));
  for (const k of dataKeys) await repo.docs.remove(k);
  for (const i of ids) for (const k of sidecarKeysOf(i)) await repo.docs.remove(k);
  for (const [other, m] of meta) if (!gone.has(other) && m.coverUri) covers.delete(m.coverUri);
  repo.notifyChanged();
  return [...covers];
}

async function deleteWhere(
  repo: NovelRepository,
  pick: (r: TrashRecord) => boolean,
): Promise<string[]> {
  const covers: string[] = [];
  for (const r of await loadTrashRecords(repo.docs))
    if (pick(r)) covers.push(...(await permanentlyDeleteItem(repo, r.id)));
  return covers;
}

/** Deletes everything in Trash for good. Returns now-unused cover URIs. */
export const emptyTrash = (repo: NovelRepository): Promise<string[]> =>
  deleteWhere(repo, () => true);

/** Deletes items trashed 30+ days ago. Safe to run on every launch. Returns unused cover URIs. */
export const purgeExpiredTrash = (repo: NovelRepository, now = Date.now()): Promise<string[]> =>
  deleteWhere(repo, (r) => isTrashExpired(r, now));
