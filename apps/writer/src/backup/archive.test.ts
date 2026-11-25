import { describe, expect, it } from 'vitest';
import { bytesOf, unzipFiles, zipFiles } from '../export/zip.ts';
import { createMemoryAdapter } from '../storage/memory.ts';
import type { StorageAdapter } from '../storage/types.ts';
import { NovelRepository } from '../store/repository.ts';
import { restoreChapter } from './archive-chapter.ts';
import {
  packChapter,
  packNovel,
  packWorkspace,
  restoreNovel,
  restoreWorkspace,
} from './archive.ts';

async function dump(a: StorageAdapter): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const k of await a.keys('')) out[k] = (await a.get(k))!;
  return out;
}

async function seeded() {
  const adapter = createMemoryAdapter();
  const repo = new NovelRepository(adapter, () => 5);
  const novel = await repo.createNovel({ title: 'Tide', author: 'Me', sectionLabel: 'Season' });
  const season = (await repo.listSeasons(novel.id))[0]!;
  const chapter = (await repo.listChapters(novel.id, season.id))[0]!;
  await repo.saveChapter(novel.id, {
    ...chapter,
    blocks: [{ id: '01HZZZZZZZZZZZZZZZZZZZZZ01', kind: 'prose', text: 'Hello **world**' }],
  });
  await adapter.set(
    `meta/chapter-styles/${chapter.id}`,
    JSON.stringify({ data: { x: { align: 'center' } }, updatedAt: 1 }),
  );
  await adapter.set(
    `meta/item/${novel.id}`,
    JSON.stringify({ data: { tags: ['a'] }, updatedAt: 1 }),
  );
  await adapter.set('setting/app', JSON.stringify({ data: { appearance: 'dark' }, updatedAt: 1 }));
  await adapter.set('setting/lock', JSON.stringify({ data: { hash: 'SECRET' }, updatedAt: 1 }));
  await adapter.set('setting/lock-pin', JSON.stringify({ data: { pin: '1234' }, updatedAt: 1 }));
  await adapter.set(
    'setting/publish',
    JSON.stringify({ data: { apiUrl: 'https://a' }, updatedAt: 1 }),
  );
  await adapter.set('setting/publish-secret', JSON.stringify({ data: 'TOKEN', updatedAt: 1 }));
  return { adapter, repo, novel, season, chapter };
}

describe('workspace archive', () => {
  it('round-trips every key and excludes lock secrets', async () => {
    const { adapter } = await seeded();
    const bytes = await packWorkspace(adapter);
    const names = Object.keys(await unzipFiles(bytes));
    expect(names.some((n) => n.includes('lock'))).toBe(false);
    expect(names.some((n) => n.includes('publish-secret'))).toBe(false);
    expect(names).toContain('kv/setting/publish');
    const target = createMemoryAdapter();
    await restoreWorkspace(target, bytes);
    const expected = await dump(adapter);
    delete expected['setting/lock'];
    delete expected['setting/lock-pin'];
    delete expected['setting/publish-secret'];
    expect(await dump(target)).toEqual(expected);
  });

  it('keeps existing lock secrets and drops stale keys on restore', async () => {
    const { adapter } = await seeded();
    const bytes = await packWorkspace(adapter);
    const target = createMemoryAdapter({
      'setting/lock': '"mine"',
      'setting/publish-secret': '"my-token"',
      'doc/stale': '{"data":{},"updatedAt":1}',
    });
    await restoreWorkspace(target, bytes);
    expect(await target.get('setting/lock')).toBe('"mine"');
    expect(await target.get('setting/publish-secret')).toBe('"my-token"');
    expect(await target.get('doc/stale')).toBeNull();
  });

  it('refuses a corrupted chapter and writes nothing', async () => {
    const { adapter, novel, season, chapter } = await seeded();
    const key = `chapter/${novel.id}/${season.id}/${chapter.id}`;
    const files = await unzipFiles(await packWorkspace(adapter));
    const name = `kv/${key.split('/').join('/')}`;
    const stored = JSON.parse(new TextDecoder().decode(files[name]!)) as {
      data: { blocks: unknown[] };
    };
    stored.data.blocks = [{ id: 'nope', kind: 'prose', text: 'x' }];
    files[name] = bytesOf(JSON.stringify(stored));
    const target = createMemoryAdapter({ 'doc/keep': '{"data":1,"updatedAt":1}' });
    await expect(restoreWorkspace(target, await zipFiles(files))).rejects.toThrow(/Chapter/);
    expect(await dump(target)).toEqual({ 'doc/keep': '{"data":1,"updatedAt":1}' });
  });

  it('refuses invalid JSON entries and non-backups', async () => {
    const { adapter } = await seeded();
    const files = await unzipFiles(await packWorkspace(adapter));
    files['kv/doc/broken'] = bytesOf('{not json');
    const target = createMemoryAdapter();
    await expect(restoreWorkspace(target, await zipFiles(files))).rejects.toThrow(/not valid JSON/);
    await expect(
      restoreWorkspace(target, await zipFiles({ 'a.txt': bytesOf('x') })),
    ).rejects.toThrow();
    expect(await dump(target)).toEqual({});
  });
});

describe('knbook / knchap', () => {
  it('round-trips one novel with its sidecars', async () => {
    const { adapter, novel, chapter } = await seeded();
    const bytes = await packNovel(adapter, novel.id);
    const target = createMemoryAdapter();
    const summary = await restoreNovel(target, bytes);
    expect(summary.title).toBe('Tide');
    const got = await dump(target);
    expect(got[`novel/${novel.id}`]).toBe(await adapter.get(`novel/${novel.id}`));
    expect(got[`meta/chapter-styles/${chapter.id}`]).toBeDefined();
    expect(got[`meta/item/${novel.id}`]).toBeDefined();
    expect(got['setting/app']).toBeUndefined();
    const repo = new NovelRepository(target);
    expect((await repo.exportNovel(novel.id)).seasons[0]!.chapters[0]!.blocks).toHaveLength(1);
  });

  it('rejects the wrong archive kind', async () => {
    const { adapter, novel } = await seeded();
    await expect(restoreNovel(createMemoryAdapter(), await packWorkspace(adapter))).rejects.toThrow(
      /knbook/,
    );
    expect(novel.id).toBeTruthy();
  });

  it('imports a chapter under a fresh id', async () => {
    const { adapter, novel, season, chapter } = await seeded();
    const bytes = await packChapter(adapter, novel.id, season.id, chapter.id);
    const id = await restoreChapter(adapter, bytes, { novelId: novel.id, seasonId: season.id });
    expect(id).not.toBe(chapter.id);
    const repo = new NovelRepository(adapter);
    const chapters = await repo.listChapters(novel.id, season.id);
    expect(chapters.map((c) => c.id)).toEqual([chapter.id, id]);
    expect(await adapter.get(`meta/chapter-styles/${id}`)).not.toBeNull();
  });
});
