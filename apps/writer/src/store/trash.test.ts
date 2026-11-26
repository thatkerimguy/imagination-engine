import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system', () => ({
  File: class {
    exists = false;
  },
}));

import { kvFromAdapter, scanWorkspace } from '../diagnostics/doctor.ts';
import { listFolderNotes, listNovelEntries } from '../export/compile-source.ts';
import { inspectNovelForPublish } from '../publish/publish-client.ts';
import { loadSearchSources } from '../search/search-sources.ts';
import { createMemoryAdapter } from '../storage/memory.ts';
import { createDoc, createFolder, getDoc, listAllDocs, listChildren } from './folders.ts';
import { recordGrowth } from './growth-store.ts';
import { updateItemMeta } from './item-meta.ts';
import { addChapter, addSeason } from './outline.ts';
import { NovelRepository } from './repository.ts';
import {
  DAY_MS,
  deletesInLabel,
  emptyTrash,
  hiddenNoteIds,
  listTrashedItems,
  moveToTrash,
  permanentlyDeleteItem,
  purgeExpiredTrash,
  restoreTrashedItem,
  trashDaysLeft,
} from './trash.ts';

const T0 = Date.parse('2026-11-01T12:00:00Z');

async function setup() {
  const adapter = createMemoryAdapter();
  const repo = new NovelRepository(adapter);
  const novel = await repo.createNovel({ title: 'Tide', author: 'A', sectionLabel: 'Season' });
  const s1 = novel.seasons[0]!;
  const c1 = (await repo.getSeason(novel.id, s1))!.chapters[0]!;
  const c2 = (await addChapter(repo, novel.id, s1, 'Two')).id;
  const s2 = (await addSeason(repo, novel.id, 'Later')).id;
  const c3 = (await addChapter(repo, novel.id, s2, 'Three')).id;
  return { adapter, repo, n: novel.id, s1, s2, c1, c2, c3 };
}

const chapterIds = async (repo: NovelRepository, n: string) =>
  (await listNovelEntries(repo, n)).map((e) => e.id);

describe('30-day Trash', () => {
  it('hides a trashed chapter from outline, search, compile and publish', async () => {
    const { repo, n, s1, c1, c2, c3 } = await setup();
    await moveToTrash(repo, { kind: 'chapter', novelId: n, seasonId: s1, chapterId: c2 }, T0);
    expect(await chapterIds(repo, n)).toEqual([c1, c3]);
    expect((await loadSearchSources(repo)).chapters.map((c) => c.chapterId)).not.toContain(c2);
    const plan = await inspectNovelForPublish(repo, n, async () => null);
    expect(plan.draftChapters).toBe(2);
    expect((await repo.listNovels())[0]?.chapterCount).toBe(2);
    expect(await repo.getChapter(n, s1, c2)).not.toBeNull(); // still stored
  });

  it('restores a chapter intact, back at its old position', async () => {
    const { repo, n, s1, c1, c2, c3 } = await setup();
    const before = await repo.getChapter(n, s1, c1);
    await moveToTrash(repo, { kind: 'chapter', novelId: n, seasonId: s1, chapterId: c1 }, T0);
    await restoreTrashedItem(repo, c1);
    expect(await chapterIds(repo, n)).toEqual([c1, c2, c3]);
    expect(await repo.getChapter(n, s1, c1)).toEqual(before);
    expect(await listTrashedItems(repo, T0)).toEqual([]);
  });

  it('restoring a chapter also restores its trashed season and book', async () => {
    const { repo, n, s1, s2, c1, c2, c3 } = await setup();
    await moveToTrash(repo, { kind: 'chapter', novelId: n, seasonId: s2, chapterId: c3 }, T0);
    await moveToTrash(repo, { kind: 'season', novelId: n, seasonId: s2 }, T0 + 1);
    await moveToTrash(repo, { kind: 'novel', novelId: n }, T0 + 2);
    expect(await repo.listNovels()).toEqual([]);
    expect((await listTrashedItems(repo, T0)).map((t) => t.kind)).toEqual([
      'novel',
      'season',
      'chapter',
    ]);
    await restoreTrashedItem(repo, c3);
    expect((await repo.listNovels()).map((x) => x.id)).toEqual([n]);
    expect((await repo.requireNovel(n)).seasons).toEqual([s1, s2]);
    expect(await chapterIds(repo, n)).toEqual([c1, c2, c3]);
    expect(await listTrashedItems(repo, T0)).toEqual([]);
  });

  it("refuses to trash a book's only season", async () => {
    const { repo, n, s2 } = await setup();
    await moveToTrash(repo, { kind: 'season', novelId: n, seasonId: s2 }, T0);
    const only = (await repo.requireNovel(n)).seasons[0]!;
    await expect(
      moveToTrash(repo, { kind: 'season', novelId: n, seasonId: only }, T0),
    ).rejects.toThrow(/at least one season/);
  });

  it('hides notes inside a trashed folder and restores parents with a note', async () => {
    const { repo } = await setup();
    const top = await createFolder(repo, 'World', null);
    const sub = await createFolder(repo, 'Harbour', top.id);
    const note = await createDoc(repo, sub.id, { title: 'Docks' });
    const loose = await createDoc(repo, null, { title: 'Loose' });
    await moveToTrash(repo, { kind: 'folder', id: top.id }, T0);
    expect((await listAllDocs(repo)).map((d) => d.id)).toEqual([loose.id]);
    expect((await listChildren(repo, null)).folders).toEqual([]);
    expect((await loadSearchSources(repo)).docs.map((d) => d.id)).toEqual([loose.id]);
    expect(await listFolderNotes(repo, sub.id)).toEqual([]);
    await moveToTrash(repo, { kind: 'doc', id: note.id }, T0 + 1);
    await restoreTrashedItem(repo, note.id);
    expect((await listAllDocs(repo)).map((d) => d.id).sort()).toEqual([loose.id, note.id].sort());
    expect(await listTrashedItems(repo, T0)).toEqual([]);
  });

  it('keeps 29-day items and purges 31-day items with their unused covers', async () => {
    const { repo, n, s1, c2 } = await setup();
    const old = await createDoc(repo, null, { title: 'Old' });
    const recent = await createDoc(repo, null, { title: 'Recent' });
    await updateItemMeta(repo, old.id, { coverUri: 'file:///d/covers/a.jpg' });
    await updateItemMeta(repo, n, { coverUri: 'file:///d/covers/shared.jpg' });
    await updateItemMeta(repo, c2, { coverUri: 'file:///d/covers/shared.jpg' });
    await moveToTrash(repo, { kind: 'doc', id: old.id }, T0);
    await moveToTrash(repo, { kind: 'doc', id: recent.id }, T0 + 2 * DAY_MS);
    await moveToTrash(repo, { kind: 'chapter', novelId: n, seasonId: s1, chapterId: c2 }, T0);
    const covers = await purgeExpiredTrash(repo, T0 + 31 * DAY_MS);
    expect(covers).toEqual(['file:///d/covers/a.jpg']); // shared.jpg is still used by the book
    expect(await getDoc(repo, old.id)).toBeNull();
    expect(await repo.getChapter(n, s1, c2)).toBeNull();
    expect((await listTrashedItems(repo, T0 + 31 * DAY_MS)).map((t) => t.id)).toEqual([recent.id]);
    expect(await getDoc(repo, recent.id)).not.toBeNull(); // 29 days old: kept
  });

  it('deletes a trashed book forever with every season, chapter and sidecar', async () => {
    const { adapter, repo, n, c1 } = await setup();
    await updateItemMeta(repo, c1, { tags: ['x'] });
    await moveToTrash(repo, { kind: 'novel', novelId: n }, T0);
    await permanentlyDeleteItem(repo, n);
    const left = await adapter.keys('');
    expect(left.filter((k) => /^(novel|season|chapter|trash|meta\/item)\//.test(k))).toEqual([]);
    await createDoc(repo, null, { title: 'X' });
    await moveToTrash(repo, { kind: 'doc', id: (await listAllDocs(repo))[0]!.id }, T0);
    await emptyTrash(repo);
    expect(await listAllDocs(repo)).toEqual([]);
  });

  it('Doctor does not report trashed items as orphans', async () => {
    const { adapter, repo, n, s1, s2, c2 } = await setup();
    await moveToTrash(repo, { kind: 'chapter', novelId: n, seasonId: s1, chapterId: c2 }, T0);
    await moveToTrash(repo, { kind: 'season', novelId: n, seasonId: s2 }, T0);
    const f = await createFolder(repo, 'F', null);
    await createDoc(repo, f.id, { title: 'N' });
    await moveToTrash(repo, { kind: 'folder', id: f.id }, T0);
    expect(await scanWorkspace(kvFromAdapter(adapter))).toEqual([]);
    await adapter.set('trash/ghost', JSON.stringify({ data: {}, updatedAt: 1 }));
    expect((await scanWorkspace(kvFromAdapter(adapter))).map((i) => i.id)).toEqual([
      'orphan-sidecar:trash/ghost',
    ]);
  });
});

describe('Gate 2 E4: Empty Trash leaves no sidecars', () => {
  it('purges growth, versions and meta for a deleted note so Doctor reports 0 findings', async () => {
    const { adapter, repo } = await setup();
    const note = await createDoc(repo, null, { title: 'Scratch' });
    await recordGrowth(
      repo,
      `doc:${note.id}`,
      { chars: 5, words: 1, sentences: 1, paragraphs: 1 },
      { force: true },
    );
    await updateItemMeta(repo, note.id, { tags: ['x'] });
    await moveToTrash(repo, { kind: 'doc', id: note.id }, T0);
    await emptyTrash(repo);
    expect(await adapter.keys(`growth/doc:${note.id}`)).toEqual([]);
    expect(await scanWorkspace(kvFromAdapter(adapter))).toEqual([]);
  });

  it('purges chapter and novel growth when a whole book is deleted forever', async () => {
    const { adapter, repo, n, c1 } = await setup();
    const counts = { chars: 5, words: 1, sentences: 1, paragraphs: 1 };
    await recordGrowth(repo, `chapter:${c1}`, counts, { force: true });
    await recordGrowth(repo, `novel:${n}`, counts, { force: true });
    await moveToTrash(repo, { kind: 'novel', novelId: n }, T0);
    await permanentlyDeleteItem(repo, n);
    expect(await adapter.keys('growth/')).toEqual([]);
    expect(await scanWorkspace(kvFromAdapter(adapter))).toEqual([]);
  });
});

describe('trash model', () => {
  it('counts down from 30 days', () => {
    const r = { deletedAt: new Date(T0).toISOString() };
    expect(trashDaysLeft(r, T0)).toBe(30);
    expect(trashDaysLeft(r, T0 + 29.5 * DAY_MS)).toBe(1);
    expect(trashDaysLeft(r, T0 + 40 * DAY_MS)).toBe(0);
    expect(deletesInLabel(30)).toBe('Deletes in 30 days');
    expect(deletesInLabel(1)).toBe('Deletes in 1 day');
    expect(deletesInLabel(0)).toBe('Deletes today');
  });

  it('hides nested notes, cycle-safe', () => {
    const folders = [
      { id: 'a', parentFolderId: null },
      { id: 'b', parentFolderId: 'a' },
      { id: 'x', parentFolderId: 'y' },
      { id: 'y', parentFolderId: 'x' },
    ];
    const docs = [
      { id: 'd1', parentFolderId: 'b' },
      { id: 'd2', parentFolderId: null },
    ];
    expect([...hiddenNoteIds(folders, docs, new Set(['a']))].sort()).toEqual(['a', 'b', 'd1']);
    expect([...hiddenNoteIds(folders, docs, new Set(['d2']))]).toEqual(['d2']);
  });
});
