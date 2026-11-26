import { isUlid, type ChapterDocument, type NovelManifest } from '@kn/core';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryDatabase } from '../db/memory-driver.ts';
import { ValidationError } from './errors.ts';
import { NovelRepository } from './repository.ts';

function setup(start = 1000) {
  let t = start;
  const adapter = createMemoryDatabase();
  const repo = new NovelRepository(adapter, () => t++);
  return { adapter, repo, tick: (to: number) => void (t = to) };
}

const input = { title: ' Tide ', author: ' Me ', sectionLabel: 'Season' as const };

describe('NovelRepository.createNovel', () => {
  it('creates a valid manifest with one season and one draft chapter', async () => {
    const { repo } = setup();
    const novel = await repo.createNovel({ ...input, sectionLabel: 'Volume' });
    expect(novel.id).toMatch(/^[0-9a-z]{26}$/);
    expect(isUlid(novel.id.toUpperCase())).toBe(true);
    expect(novel.title).toBe('Tide');
    expect(novel.author).toBe('Me');
    expect(novel.sectionLabel).toBe('Volume');
    expect(novel.seasons).toHaveLength(1);
    const seasons = await repo.listSeasons(novel.id);
    expect(seasons[0]?.title).toBe('Volume 1');
    const chapters = await repo.listChapters(novel.id, seasons[0]!.id);
    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.status).toBe('draft');
    expect(chapters[0]?.blocks).toEqual([]);
  });
});

describe('NovelRepository.listNovels', () => {
  it('reports counts, latest write as updatedAt, and sorts newest first', async () => {
    const { repo, tick } = setup(1000);
    const a = await repo.createNovel({ ...input, title: 'A' });
    const b = await repo.createNovel({ ...input, title: 'B' });
    let list = await repo.listNovels();
    expect(list.map((n) => n.title)).toEqual(['B', 'A']);
    expect(list[0]).toMatchObject({ seasonCount: 1, chapterCount: 1 });

    tick(9000);
    const [season] = await repo.listSeasons(a.id);
    const [chapter] = await repo.listChapters(a.id, season!.id);
    const saved = await repo.saveChapter(a.id, chapter!);
    list = await repo.listNovels();
    expect(list.map((n) => n.title)).toEqual(['A', 'B']);
    expect(list[0]?.updatedAt).toBe(saved.updatedAt);
    expect(list[1]?.id).toBe(b.id);
  });
});

describe('NovelRepository.saveNovel', () => {
  it('rejects invalid manifests and stores nothing', async () => {
    const { repo, adapter } = setup();
    const base: NovelManifest = {
      schemaVersion: 1,
      id: 'abc',
      title: 'T',
      author: 'A',
      sectionLabel: 'Season',
      theme: {},
      enabledModules: [],
      seasons: [],
    };
    await expect(repo.saveNovel({ ...base, title: '' })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.saveNovel({ ...base, theme: { color: 'red' } })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(await adapter.listNodes({ includeDeleted: true })).toEqual([]);
  });
});

describe('NovelRepository.saveChapter', () => {
  async function fresh() {
    const ctx = setup();
    const novel = await ctx.repo.createNovel(input);
    const [season] = await ctx.repo.listSeasons(novel.id);
    const [chapter] = await ctx.repo.listChapters(novel.id, season!.id);
    return { ...ctx, novel, chapter: chapter! };
  }
  const ids = [
    '01M7WD7TG0SRH8FFJAF28FHTHC',
    '01M7WD7TG1R63M5MJ69NG6995F',
    '01M7WD7TG2E6A9YY5JE036YWV9',
  ];

  it('skips unfinished blocks and drops empty optional fields', async () => {
    const { repo, novel, chapter } = await fresh();
    const draft: ChapterDocument = {
      ...chapter,
      blocks: [
        { id: ids[0]!, kind: 'prose', text: '  ' },
        { id: ids[1]!, kind: 'dialogue', speaker: '', text: 'hi' },
        { id: ids[2]!, kind: 'scene-break', label: '', timestamp: ' ' },
      ],
    };
    const res = await repo.saveChapter(novel.id, draft);
    expect(res.skipped).toEqual([ids[0], ids[1]]);
    expect(res.chapter.blocks).toEqual([{ id: ids[2], kind: 'scene-break' }]);
    const stored = await repo.getChapter(novel.id, chapter.seasonId, chapter.id);
    expect(stored).toEqual(res.chapter);
  });

  it('rejects duplicate block ids', async () => {
    const { repo, novel, chapter } = await fresh();
    const dup: ChapterDocument = {
      ...chapter,
      blocks: [
        { id: ids[0]!, kind: 'prose', text: 'a' },
        { id: ids[0]!, kind: 'prose', text: 'b' },
      ],
    };
    await expect(repo.saveChapter(novel.id, dup)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('NovelRepository subscribe / delete', () => {
  it('notifies listeners on writes until unsubscribed', async () => {
    const { repo } = setup();
    const fn = vi.fn();
    const off = repo.subscribe(fn);
    await repo.createNovel(input);
    expect(fn).toHaveBeenCalled();
    const calls = fn.mock.calls.length;
    off();
    await repo.createNovel(input);
    expect(fn.mock.calls.length).toBe(calls);
  });

  it('deleteNovel cascades to the season, chapter, body and growth rows', async () => {
    const { repo, adapter } = setup();
    const keep = await repo.createNovel(input);
    const gone = await repo.createNovel(input);
    await repo.deleteNovel(gone.id);
    const left = await adapter.listNodes({ includeDeleted: true });
    expect(left.some((n) => n.id === gone.id || n.bookId === gone.id)).toBe(false);
    expect(left.filter((n) => n.id === keep.id || n.bookId === keep.id)).toHaveLength(3);
    expect((await adapter.listGrowthLogs({})).every((g) => g.bookId === keep.id)).toBe(true);
    expect(await adapter.integrity()).toMatchObject({ orphanBodies: 0, orphanGrowth: 0 });
  });

  it('keeps workspace mode per book: prose by default, toggleable', async () => {
    const { repo } = setup();
    const n = await repo.createNovel(input);
    expect(await repo.getWorkspaceMode(n.id)).toBe('prose');
    await repo.setWorkspaceMode(n.id, 'interactive');
    expect(await repo.getWorkspaceMode(n.id)).toBe('interactive');
    expect((await repo.exportNovel(n.id)).workspaceMode).toBe('interactive');
  });
});

const ids = ['01M7WD7TG0SRH8FFJAF28FHTHC'];

describe('bundles', () => {
  it('export -> import round-trips into a fresh repository', async () => {
    const a = setup();
    const novel = await a.repo.createNovel(input);
    const bundle = await a.repo.exportNovel(novel.id);
    const b = setup();
    await b.repo.importBundle(bundle);
    expect(await b.repo.exportNovel(novel.id)).toEqual(bundle);
  });

  it('validates everything before writing anything', async () => {
    const a = setup();
    const novel = await a.repo.createNovel(input);
    const bundle = await a.repo.exportNovel(novel.id);
    const bad = structuredClone(bundle);
    bad.seasons[0]!.chapters[0]!.blocks.push(
      { id: ids[0]!, kind: 'prose', text: 'a' },
      { id: ids[0]!, kind: 'prose', text: 'b' },
    );
    const b = setup();
    await expect(b.repo.importBundle(bad)).rejects.toBeInstanceOf(ValidationError);
    expect(await b.adapter.listNodes({ includeDeleted: true })).toEqual([]);
  });
});
