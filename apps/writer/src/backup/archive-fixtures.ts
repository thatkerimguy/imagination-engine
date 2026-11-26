// Shared fixtures for the archive tests.
import { createMemoryDatabase } from '../db/memory-driver.ts';
import { setItemCover } from '../store/covers.ts';
import { NovelRepository } from '../store/repository.ts';
import type { CoverMedia } from './archive-covers.ts';

export const NOW = Date.parse('2026-11-26T12:00:00Z');
export const BLOCK = '01HZZZZZZZZZZZZZZZZZZZZZ01';
export const newRepo = (root = 'file:///old/') =>
  new NovelRepository(createMemoryDatabase(), () => NOW, root);

export const memMedia = (dir: string, files: Map<string, Uint8Array>): CoverMedia => ({
  read: async (uri) => files.get(uri) ?? null,
  write: async (name, bytes) => {
    files.set(`${dir}${name}`, bytes);
    return `${dir}${name}`;
  },
});

export async function seeded() {
  const repo = newRepo();
  const novel = await repo.createNovel({ title: 'Tide', author: 'Me', sectionLabel: 'Season' });
  const season = (await repo.listSeasons(novel.id))[0]!;
  const chapter = (await repo.listChapters(novel.id, season.id))[0]!;
  await repo.saveChapter(novel.id, {
    ...chapter,
    blocks: [{ id: BLOCK, kind: 'prose', text: 'Hello **lighthouse**' }],
  });
  const files = new Map([
    ['file:///old/covers/abc123.jpg', new Uint8Array([1, 2, 3])],
    ['file:///old/covers/abc123.thumb.jpg', new Uint8Array([4])],
  ]);
  await setItemCover(repo, novel.id, {
    cover: {
      uri: 'file:///old/covers/abc123.jpg',
      width: 10,
      height: 20,
      bytes: 3,
      mimeType: 'image/jpeg',
    },
    thumb: {
      uri: 'file:///old/covers/abc123.thumb.jpg',
      width: 5,
      height: 5,
      bytes: 1,
      mimeType: 'image/jpeg',
    },
  });
  const set = (k: string, v: unknown) =>
    repo.db.setSetting(k, JSON.stringify({ data: v, updatedAt: 1 }));
  await set(`meta/chapter-styles/${chapter.id}`, { x: { align: 'center' } });
  await set(`meta/item/${novel.id}`, { tags: ['a'] });
  await set('setting/app', { appearance: 'dark' });
  await set('setting/lock', { hash: 'SECRET' });
  await set('setting/lock-pin', { pin: '1234' });
  await set('setting/publish', { apiUrl: 'https://a' });
  await set('setting/publish-secret', 'TOKEN');
  await set('quarantine/meta/item/x', { raw: 'junk' });
  return { repo, novel, season, chapter, files };
}

export const trash = async (repo: NovelRepository, id: string) => {
  const n = (await repo.db.getNode(id))!;
  await repo.db.putNodes([{ node: { ...n, deletedAt: '2026-11-25T00:00:00.000Z' } }]);
};
