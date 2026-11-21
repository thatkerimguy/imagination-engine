import type { ChapterDocument } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { parseRoute } from '../../../reader/src/router.ts';
import { handleRequest } from '../../../publish-api/src/worker.ts';
import { createMemoryStore, type ObjectStore } from '../../../publish-api/src/store.ts';
import { packWorkspace } from '../backup/archive.ts';
import { unzipFiles } from '../export/zip.ts';
import { createMemoryAdapter } from '../storage/memory.ts';
import { NovelRepository } from '../store/repository.ts';
import {
  inspectNovelForPublish,
  publishNovelToApi,
  unpublishNovelFromApi,
  verifyPublishConnection,
  type FetchLike,
} from './publish-client.ts';
import { chapterUrl, publicNovelUrl } from './publish-links.ts';
import {
  loadPublishStatus,
  normalizeBaseUrl,
  publishStatusKey,
  savePublishConfig,
  savePublishToken,
} from './publish-settings.ts';

const API = 'https://api.example.test';
const config = { apiUrl: API, readerUrl: 'https://read.example.test' };

const serverFetch =
  (store: ObjectStore, token = 'T'): FetchLike =>
  (url, init) =>
    handleRequest(new Request(url, init), { store, token });

async function seed() {
  const adapter = createMemoryAdapter();
  const repo = new NovelRepository(adapter, () => 5);
  const novel = await repo.createNovel({ title: 'Tide', author: 'Me', sectionLabel: 'Season' });
  const season = (await repo.listSeasons(novel.id))[0]!;
  const base = (await repo.listChapters(novel.id, season.id))[0]!;
  const make = (
    id: string,
    status: ChapterDocument['status'],
    text: string,
    extra: ChapterDocument['blocks'] = [],
  ): ChapterDocument => ({
    ...base,
    id,
    status,
    title: `Chap ${id.slice(-2)}`,
    blocks: [
      {
        id: `01HZZZZZZZZZZZZZZZZZZZZ${id.length.toString().padStart(3, '0')}`,
        kind: 'prose',
        text,
      },
      ...extra,
    ],
  });
  const chapters = [
    make(
      'pub-one',
      'published',
      'A {fg:#ff0000}red{/fg} and {bg:#00ff00}green{/bg} {{comment:fix me}}tide.',
      [{ id: '01HZZZZZZZZZZZZZZZZZZZZZB2', kind: 'prose', text: '   ' }],
    ),
    make('unl-two', 'unlisted', 'Hidden'),
    make('drf-three', 'draft', 'Wip'),
  ];
  // Write raw (repo.saveChapter would sanitize first, defeating the test).
  for (const c of chapters) await repo.docs.write(`chapter/${novel.id}/${season.id}/${c.id}`, c);
  await repo.docs.write(`season/${novel.id}/${season.id}`, {
    ...season,
    chapters: chapters.map((c) => c.id),
  });
  return { adapter, repo, novelId: novel.id, seasonId: season.id };
}

describe('inspectNovelForPublish', () => {
  it('counts statuses, strips writer markup and warns about unfinished blocks', async () => {
    const { repo, novelId } = await seed();
    const plan = await inspectNovelForPublish(repo, novelId);
    expect(plan.publishedChapters).toBe(1);
    expect(plan.unlistedChapters).toBe(1);
    expect(plan.draftChapters).toBe(1);
    expect(plan.skippedBlocks).toBe(1);
    expect(plan.firstPublished?.title).toBe('Chap ne');
    expect(plan.unlistedItems).toHaveLength(1);
    expect(plan.warnings).toContain('1 unfinished block will be left out.');
    const json = JSON.stringify(plan.payload);
    expect(json).not.toMatch(/\{\{comment|\{fg|\{bg|\{\/fg|\{\/bg/);
    expect(json).toContain('red');
    expect(plan.payload.seasons[0]!.chapters).toHaveLength(2);
  });

  it('warns when everything is a draft or nothing is published', async () => {
    const { repo, novelId } = await seed();
    const all = await repo.exportNovel(novelId);
    const s = all.seasons[0]!;
    for (const c of s.chapters) {
      await repo.docs.write(`chapter/${novelId}/${s.season.id}/${c.id}`, { ...c, status: 'draft' });
    }
    expect((await inspectNovelForPublish(repo, novelId)).warnings[0]).toMatch(
      /All chapters are drafts/,
    );
    const unl = s.chapters[1]!;
    await repo.docs.write(`chapter/${novelId}/${s.season.id}/${unl.id}`, unl);
    expect((await inspectNovelForPublish(repo, novelId)).warnings[0]).toMatch(
      /No published chapters/,
    );
  });
});

describe('verifyPublishConnection', () => {
  it('maps responses to states', async () => {
    const store = createMemoryStore();
    expect((await verifyPublishConnection(API, 'T', serverFetch(store))).state).toBe('ok');
    expect((await verifyPublishConnection(API, 'bad', serverFetch(store))).state).toBe(
      'unauthorized',
    );
    const noToken: FetchLike = (u, i) => handleRequest(new Request(u, i), { store });
    expect((await verifyPublishConnection(API, 'T', noToken)).state).toBe('misconfigured');
    const boom: FetchLike = async () => {
      throw new TypeError('offline');
    };
    expect((await verifyPublishConnection(API, 'T', boom)).state).toBe('unreachable');
    const blank = await verifyPublishConnection('', '', boom);
    expect(blank).toEqual({ state: 'misconfigured', message: 'Add the API URL and token first.' });
  });
});

describe('publish / unpublish end to end', () => {
  it('publishes, records status, then unpublishes', async () => {
    const { repo, novelId, seasonId } = await seed();
    const store = createMemoryStore();
    const f = serverFetch(store);
    const res = await publishNovelToApi(repo, novelId, config, 'T', f);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.response.publishedChapters).toBe(1);

    const text = async (key: string): Promise<string | null> => {
      const o = await store.get(key);
      return o ? new TextDecoder().decode(o.body) : null;
    };
    expect(JSON.parse((await text('novels/index.json'))!).novels).toContain(novelId);
    const stored = await text(`novels/${novelId}/seasons/${seasonId}/pub-one.json`);
    expect(stored).not.toBeNull();
    expect(stored).not.toMatch(/\{\{comment|\{fg|\{bg/);
    expect(await text(`novels/${novelId}/seasons/${seasonId}/drf-three.json`)).toBeNull();
    expect(await text(`novels/${novelId}/seasons/${seasonId}/unl-two.json`)).not.toBeNull();
    const season = JSON.parse((await text(`novels/${novelId}/seasons/${seasonId}/season.json`))!);
    expect(season.chapters).toEqual(['pub-one']);
    expect((await loadPublishStatus(repo, novelId))?.publishedChapters).toBe(1);
    expect(await repo.docs.read(publishStatusKey(novelId))).not.toBeNull();

    const gone = await unpublishNovelFromApi(repo, novelId, config, 'T', f);
    expect(gone.ok).toBe(true);
    expect(await loadPublishStatus(repo, novelId)).toBeNull();
    expect(JSON.parse((await text('novels/index.json')) ?? '{"novels":[]}').novels).not.toContain(
      novelId,
    );
    expect(await text(`novels/${novelId}/novel.json`)).toBeNull();
  });

  it('reports failures calmly', async () => {
    const { repo, novelId } = await seed();
    const store = createMemoryStore();
    const bad = await publishNovelToApi(repo, novelId, config, 'nope', serverFetch(store));
    expect(bad).toMatchObject({ ok: false, kind: 'unauthorized', error: 'Invalid token' });
    const none = await publishNovelToApi(repo, novelId, { apiUrl: '', readerUrl: '' }, 'T');
    expect(none).toMatchObject({ ok: false, kind: 'unconfigured' });
    const boom: FetchLike = async () => {
      throw new Error('x');
    };
    expect(await publishNovelToApi(repo, novelId, config, 'T', boom)).toMatchObject({
      kind: 'unreachable',
    });
  });
});

describe('settings and links', () => {
  it('keeps the token out of backups but the config in', async () => {
    const { adapter, repo } = await seed();
    await savePublishConfig(repo, { apiUrl: ` ${API}/ `, readerUrl: '' });
    await savePublishToken(repo, ' secret-token ');
    expect(await adapter.get('setting/publish-secret')).not.toBeNull();
    const files = await unzipFiles(await packWorkspace(adapter));
    const names = Object.keys(files);
    expect(names.some((n) => n.includes('setting/publish-secret'))).toBe(false);
    expect(names.some((n) => n.endsWith('kv/setting/publish'))).toBe(true);
  });

  it('normalizes URLs', async () => {
    expect(normalizeBaseUrl('  https://a.test/// ')).toBe('https://a.test');
    expect(normalizeBaseUrl('  ')).toBe('');
    expect(normalizeBaseUrl('ftp://a.test')).toBeNull();
    expect(normalizeBaseUrl('nope')).toBeNull();
    const { repo } = await seed();
    await expect(savePublishConfig(repo, { apiUrl: 'nope', readerUrl: '' })).rejects.toThrow(
      /http/,
    );
  });

  it('builds links the reader parses back', () => {
    const n = parseRoute(new URL(publicNovelUrl('https://r.test/app/', 'my-book')).search, '');
    expect(n).toEqual({ view: 'seasons', novel: 'my-book' });
    const url = chapterUrl('https://r.test/app', 'my-book', 'season-1', 'ch-1');
    expect(url.startsWith('https://r.test/app/?')).toBe(true);
    expect(parseRoute(new URL(url).search, '')).toEqual({
      view: 'read',
      novel: 'my-book',
      season: 'season-1',
      chapter: 'ch-1',
      block: null,
    });
  });
});
