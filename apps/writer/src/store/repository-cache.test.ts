import type { ChapterDocument } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../storage/memory.ts';
import type { StorageAdapter } from '../storage/types.ts';
import { NovelRepository } from './repository.ts';

interface Spy {
  adapter: StorageAdapter;
  gets: () => number;
  failSets: (on: boolean) => void;
}

function spyOn(inner: StorageAdapter): Spy {
  let gets = 0;
  let failing = false;
  const adapter: StorageAdapter = {
    get: (k) => {
      gets++;
      return inner.get(k);
    },
    set: (k, v) => (failing ? Promise.reject(new Error('disk full')) : inner.set(k, v)),
    remove: (k) => inner.remove(k),
    keys: (p) => inner.keys(p),
  };
  return { adapter, gets: () => gets, failSets: (on) => void (failing = on) };
}

async function setup() {
  const spy = spyOn(createMemoryAdapter());
  let t = 1000;
  const repo = new NovelRepository(spy.adapter, () => t++);
  const novel = await repo.createNovel({ title: 'Tide', author: 'Me', sectionLabel: 'Season' });
  const seasonId = novel.seasons[0]!;
  const [chapter] = await repo.listChapters(novel.id, seasonId);
  return { spy, repo, novel, seasonId, chapter: chapter! };
}

const withText = (c: ChapterDocument, text: string): ChapterDocument => ({
  ...c,
  blocks: [{ id: '01HZX0000000000000000000B1', kind: 'prose', text }],
});

describe('NovelRepository read cache', () => {
  it('serves repeated reads from memory', async () => {
    const { spy, repo, novel, seasonId, chapter } = await setup();
    await repo.getNovel(novel.id);
    await repo.listChapters(novel.id, seasonId);
    await repo.getChapter(novel.id, seasonId, chapter.id);
    const before = spy.gets();
    for (let i = 0; i < 3; i++) {
      await repo.getNovel(novel.id);
      await repo.listChapters(novel.id, seasonId);
      await repo.getChapter(novel.id, seasonId, chapter.id);
    }
    expect(spy.gets()).toBe(before);
  });

  it('shows saved chapters and novels immediately without extra gets', async () => {
    const { spy, repo, novel, seasonId, chapter } = await setup();
    await repo.getChapter(novel.id, seasonId, chapter.id);
    await repo.saveChapter(novel.id, withText(chapter, 'Fresh line.'));
    await repo.saveNovel({ ...novel, title: 'Renamed' });
    const before = spy.gets();
    const read = await repo.getChapter(novel.id, seasonId, chapter.id);
    expect(read?.blocks[0]).toMatchObject({ text: 'Fresh line.' });
    expect((await repo.getNovel(novel.id))?.title).toBe('Renamed');
    expect(spy.gets()).toBe(before);
  });

  it('returns null for every read after deleteNovel', async () => {
    const { repo, novel, seasonId, chapter } = await setup();
    await repo.getNovel(novel.id);
    await repo.deleteNovel(novel.id);
    expect(await repo.getNovel(novel.id)).toBeNull();
    expect(await repo.getChapter(novel.id, seasonId, chapter.id)).toBeNull();
  });

  it('clearCache() makes the next read hit the adapter again', async () => {
    const { spy, repo, novel } = await setup();
    await repo.getNovel(novel.id);
    const warm = spy.gets();
    await repo.getNovel(novel.id);
    expect(spy.gets()).toBe(warm);
    repo.clearCache();
    await repo.getNovel(novel.id);
    expect(spy.gets()).toBe(warm + 1);
  });

  it('does not keep a stale value when adapter.set fails', async () => {
    const { spy, repo, novel, seasonId, chapter } = await setup();
    await repo.saveChapter(novel.id, withText(chapter, 'Original.'));
    spy.failSets(true);
    await expect(repo.saveChapter(novel.id, withText(chapter, 'Lost.'))).rejects.toThrow(
      'disk full',
    );
    spy.failSets(false);
    const read = await repo.getChapter(novel.id, seasonId, chapter.id);
    expect(read?.blocks[0]).toMatchObject({ text: 'Original.' });
  });
});
