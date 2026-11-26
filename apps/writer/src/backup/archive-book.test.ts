import { describe, expect, it } from 'vitest';
import { emptyTables } from '../db/port.ts';
import { bytesOf, unzipFiles, zipFiles } from '../export/zip.ts';
import { packNovel, restoreNovel } from './archive-book.ts';
import { packChapter, restoreChapter } from './archive-chapter.ts';
import { packWorkspace } from './archive.ts';
import { memMedia, newRepo, NOW, seeded, trash } from './archive-fixtures.ts';

describe('knbook / knchap', () => {
  it('exports the active subtree only (no Trash) and imports with a day-0 baseline', async () => {
    const { repo, novel, season, chapter, files } = await seeded();
    const extra = await repo.db.listNodes({ bookId: novel.id });
    expect(extra.length).toBeGreaterThan(1);
    const second = { ...chapter, id: 'chapter-two', title: 'Two', blocks: [] };
    await repo.saveChapter(novel.id, { ...second, seasonId: season.id });
    await trash(repo, 'chapter-two');
    const bytes = await packNovel(repo, novel.id, NOW, memMedia('', files));
    const zip = await unzipFiles(bytes);
    const names = Object.keys(zip);
    expect(names).toContain('covers/abc123.jpg');
    const nodesJson = new TextDecoder().decode(zip['tables/nodes.json']!);
    expect(nodesJson).not.toContain('chapter-two');
    expect(new TextDecoder().decode(zip['tables/settings.json']!)).not.toContain('setting/app');

    const target = newRepo('file:///new/');
    const written = new Map<string, Uint8Array>();
    const summary = await restoreNovel(target, bytes, memMedia('file:///new/covers/', written));
    expect(summary.title).toBe('Tide');
    expect(written.size).toBe(2);
    expect((await target.exportNovel(novel.id)).seasons[0]!.chapters).toHaveLength(1);
    expect(await target.db.getSetting(`meta/chapter-styles/${chapter.id}`)).not.toBeNull();
    expect(await target.db.getSetting(`meta/item/${novel.id}`)).not.toBeNull();
    expect(await target.db.getSetting('setting/app')).toBeNull();
    const logs = await target.db.listGrowthLogs({ bookId: novel.id });
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.every((l) => l.isBaseline)).toBe(true);
    expect((await target.db.search('lighthouse')).length).toBe(1);
  });

  it('gives an imported book fresh ids when the id already exists (never overwrites)', async () => {
    const { repo, novel } = await seeded();
    const bytes = await packNovel(repo, novel.id, NOW);
    const before = (await repo.db.listNodes({ includeDeleted: true })).length;
    await restoreNovel(repo, bytes);
    const books = await repo.db.listNodes({ parentId: null, kinds: ['book'] });
    expect(books).toHaveLength(2);
    expect((await repo.db.listNodes({ includeDeleted: true })).length).toBe(before * 2);
    const copy = books.find((b) => b.id !== novel.id)!;
    expect((await repo.exportNovel(copy.id)).seasons[0]!.chapters[0]!.blocks).toHaveLength(1);
    expect((await repo.db.integrity()).brokenParents).toBe(0);
  });

  it('rejects the wrong archive kind and a book-less knbook', async () => {
    const { repo, novel } = await seeded();
    await expect(restoreNovel(newRepo(), await packWorkspace(repo, NOW))).rejects.toThrow(/knbook/);
    const empty = await zipFiles({
      'manifest.json': bytesOf(
        JSON.stringify({
          app: 'kinetic-novel-writer',
          kind: 'knbook',
          formatVersion: 2,
          createdAt: 1,
        }),
      ),
      'tables/nodes.json': bytesOf(JSON.stringify(emptyTables().nodes)),
    });
    await expect(restoreNovel(newRepo(), empty)).rejects.toThrow(/exactly one book/);
    await expect(packNovel(repo, 'nope')).rejects.toThrow(/not found/);
    expect(novel.id).toBeTruthy();
  });

  it('imports a chapter under a fresh id with its styles and a baseline', async () => {
    const { repo, novel, season, chapter } = await seeded();
    const bytes = await packChapter(repo, chapter.id, NOW);
    const id = await restoreChapter(repo, bytes, { novelId: novel.id, seasonId: season.id });
    expect(id).not.toBe(chapter.id);
    const chapters = await repo.listChapters(novel.id, season.id);
    expect(chapters.map((c) => c.id)).toEqual([chapter.id, id]);
    expect(await repo.db.getSetting(`meta/chapter-styles/${id}`)).not.toBeNull();
    const logs = await repo.db.listGrowthLogs({ nodeId: id });
    expect(logs.some((l) => l.isBaseline)).toBe(true);
    await expect(packChapter(repo, 'nope')).rejects.toThrow(/not found/);
  });
});
