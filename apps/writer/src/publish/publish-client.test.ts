import type { ChapterDocument } from '@kn/core';
import { describe, expect, it, vi } from 'vitest';

const files = vi.hoisted(() => new Map<string, string>());
vi.mock('expo-file-system', () => ({
  File: class {
    constructor(private readonly uri: string) {}
    base64 = async (): Promise<string> => files.get(this.uri) ?? '';
  },
}));
import { parseRoute } from '../../../reader/src/router.ts';
import { handleRequest } from '../../../publish-api/src/worker.ts';
import { createMemoryStore, type ObjectStore } from '../../../publish-api/src/store.ts';
import { packWorkspace } from '../backup/archive.ts';
import { unzipFiles } from '../export/zip.ts';
import { createMemoryDatabase } from '../db/memory-driver.ts';
import { updateItemMeta } from '../store/item-meta.ts';
import { chapterNode } from '../store/node-mapping.ts';
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

/** A chapter row written raw (repo.saveChapter would sanitize first, defeating the tests). */
const rawRow = (c: ChapterDocument, novelId: string, i: number) =>
  chapterNode(c, novelId, null, i, '2026-01-01T00:00:00.000Z');

const serverFetch =
  (store: ObjectStore, token = 'T'): FetchLike =>
  (url, init) =>
    handleRequest(new Request(url, init), { store, token });

async function seed() {
  const adapter = createMemoryDatabase();
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
  await adapter.deleteNodes([base.id]);
  await adapter.putNodes(chapters.map((c, i) => rawRow(c, novel.id, i)));
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
    const { adapter, repo, novelId } = await seed();
    const all = await repo.exportNovel(novelId);
    const s = all.seasons[0]!;
    await adapter.putNodes(s.chapters.map((c, i) => rawRow({ ...c, status: 'draft' }, novelId, i)));
    expect((await inspectNovelForPublish(repo, novelId)).warnings[0]).toMatch(
      /All chapters are drafts/,
    );
    const unl = s.chapters[1]!;
    await adapter.putNodes([rawRow(unl, novelId, 1)]);
    expect((await inspectNovelForPublish(repo, novelId)).warnings[0]).toMatch(
      /No published chapters/,
    );
  });
});

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
describe('native file:// covers', () => {
  it('reads, sniffs and publishes a local cover by default', async () => {
    const { repo, novelId } = await seed();
    files.set('file:///doc/covers/a.jpg', PNG); // the bytes win over the wrong extension
    await updateItemMeta(repo, novelId, { coverUri: 'file:///doc/covers/a.jpg' });
    const plan = await inspectNovelForPublish(repo, novelId);
    expect(plan.payload.cover).toEqual({ mime: 'image/png', base64: PNG });
    const store = createMemoryStore();
    expect((await publishNovelToApi(repo, novelId, config, 'T', serverFetch(store))).ok).toBe(true);
    expect(await store.get(`novels/${novelId}/cover.png`)).not.toBeNull();
  });

  it('leaves an oversized cover out with a clear warning', async () => {
    const { repo, novelId } = await seed();
    files.set('file:///doc/covers/big.jpg', `/9j/${'A'.repeat(2_200_000)}`);
    await updateItemMeta(repo, novelId, { coverUri: 'file:///doc/covers/big.jpg' });
    const plan = await inspectNovelForPublish(repo, novelId);
    expect(plan.payload.cover).toBeUndefined();
    expect(plan.warnings.some((w) => /1\.6 MB \(limit 1\.5 MB\)/.test(w))).toBe(true);
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
    expect(await adapter.getSetting('setting/publish-secret')).not.toBeNull();
    const files = await unzipFiles(await packWorkspace(repo));
    const settings = new TextDecoder().decode(files['tables/settings.json']);
    expect(settings).not.toContain('setting/publish-secret');
    expect(settings).not.toContain('secret-token');
    expect(settings).toContain('"setting/publish"');
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
