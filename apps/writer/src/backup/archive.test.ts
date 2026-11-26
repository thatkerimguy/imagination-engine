import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system', () => ({
  File: class {
    exists = false;
  },
}));

import { kvFromAdapter, scanWorkspace } from '../diagnostics/doctor.ts';
import { bytesOf, unzipFiles, zipFiles } from '../export/zip.ts';
import { createMemoryAdapter } from '../storage/memory.ts';
import type { StorageAdapter } from '../storage/types.ts';
import { NovelRepository } from '../store/repository.ts';
import { addChapter, addSeason } from '../store/outline.ts';
import { moveToTrash } from '../store/trash.ts';
import { restoreChapter } from './archive-chapter.ts';
import { isSafeCoverName, MAX_COVER_BYTES, type CoverMedia } from './archive-covers.ts';
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

describe('Gate 2 E4: cover media in workspace backups', () => {
  const memMedia = (dir: string, files: Map<string, Uint8Array>): CoverMedia => ({
    read: async (uri) => files.get(uri) ?? null,
    write: async (name, bytes) => {
      files.set(`${dir}${name}`, bytes);
      return `${dir}${name}`;
    },
  });

  it('round-trips cover + thumbnail bytes and rewrites cover URIs to this device', async () => {
    const { adapter, novel } = await seeded();
    const oldUri = 'file:///old/phone/files/covers/abc123.jpg';
    await adapter.set(
      `meta/item/${novel.id}`,
      JSON.stringify({ data: { coverUri: oldUri }, updatedAt: 1 }),
    );
    const source = new Map([
      [oldUri, new Uint8Array([1, 2, 3])],
      ['file:///old/phone/files/covers/abc123.thumb.jpg', new Uint8Array([4])],
    ]);
    const bytes = await packWorkspace(adapter, 1, memMedia('', source));
    const names = Object.keys(await unzipFiles(bytes));
    expect(names).toContain('covers/abc123.jpg');
    expect(names).toContain('covers/abc123.thumb.jpg');

    const target = createMemoryAdapter();
    const written = new Map<string, Uint8Array>();
    const newDir = 'file:///new/phone/files/covers/';
    await restoreWorkspace(target, bytes, memMedia(newDir, written));
    expect([...written.get(`${newDir}abc123.jpg`)!]).toEqual([1, 2, 3]);
    expect([...written.get(`${newDir}abc123.thumb.jpg`)!]).toEqual([4]);
    const meta = JSON.parse((await target.get(`meta/item/${novel.id}`))!) as {
      data: { coverUri: string };
    };
    expect(meta.data.coverUri).toBe(`${newDir}abc123.jpg`);
    expect(
      await scanWorkspace(kvFromAdapter(target), { fileExists: async (u) => written.has(u) }),
    ).toEqual([]);
  });

  it('rejects traversal, non-image and oversized cover entries', async () => {
    const { adapter } = await seeded();
    const base = await unzipFiles(await packWorkspace(adapter));
    for (const bad of ['covers/../evil.jpg', 'covers/x.sh', 'covers/a/b.jpg', 'covers/.hidden.jpg'])
      await expect(
        restoreWorkspace(
          createMemoryAdapter(),
          await zipFiles({ ...base, [bad]: new Uint8Array([1]) }),
        ),
      ).rejects.toThrow(/cover/i);
    const huge = new Uint8Array(MAX_COVER_BYTES + 1);
    await expect(
      restoreWorkspace(createMemoryAdapter(), await zipFiles({ ...base, 'covers/a.jpg': huge })),
    ).rejects.toThrow(/too large/);
    expect(isSafeCoverName('01m8ajx-a.thumb.jpg')).toBe(true);
  });
});

describe('Gate 2: .knbook excludes trashed seasons and chapters', () => {
  it('drops a trashed chapter and season from a single-book archive', async () => {
    const { adapter, repo, novel, season, chapter } = await seeded();
    const extra = await addChapter(repo, novel.id, season.id, 'Two');
    const s2 = await addSeason(repo, novel.id, 'Later');
    await moveToTrash(repo, {
      kind: 'chapter',
      novelId: novel.id,
      seasonId: season.id,
      chapterId: extra.id,
    });
    await moveToTrash(repo, { kind: 'season', novelId: novel.id, seasonId: s2.id });
    const names = Object.keys(await unzipFiles(await packNovel(adapter, novel.id)));
    expect(names.some((n) => n.includes(extra.id))).toBe(false);
    expect(names.some((n) => n.includes(s2.id))).toBe(false);
    expect(names).toContain(`kv/chapter/${novel.id}/${season.id}/${chapter.id}`);
    const ws = Object.keys(await unzipFiles(await packWorkspace(adapter)));
    expect(ws).toContain(`kv/trash/${extra.id}`);
  });
});
