import { describe, expect, it } from 'vitest';
import { createMemoryStore } from './store.ts';
import type { ObjectStore } from './store.ts';
import { handleRequest } from './worker.ts';
import { MAX_COVER_BYTES } from './protocol.ts';
import { book, chapter } from './test-fixtures.ts';

const TOKEN = 'secret-token';
const NOW = new Date('2026-01-02T03:04:05.000Z');
const BASE = 'http://x.test';
const dec = new TextDecoder();

function setup() {
  const store = createMemoryStore();
  const call = (path: string, init: RequestInit = {}, token: string | undefined | null = TOKEN) =>
    handleRequest(new Request(BASE + path, init), {
      store,
      ...(token === null ? {} : { token }),
      now: () => NOW,
    });
  const authed = (method: string, path: string, body?: unknown) =>
    call(path, {
      method,
      headers: { authorization: `Bearer ${TOKEN}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const publish = (body: unknown) => authed('PUT', '/api/novels/my-novel', body);
  const read = async (key: string): Promise<unknown> => {
    const o = await store.get(key);
    return o ? JSON.parse(dec.decode(o.body)) : undefined;
  };
  return { store, call, authed, publish, read };
}

const keys = (store: ObjectStore) => store.list('');

describe('auth', () => {
  it('rejects missing and wrong tokens with 401', async () => {
    const { call } = setup();
    expect((await call('/api/verify')).status).toBe(401);
    const wrong = await call('/api/verify', { headers: { authorization: 'Bearer nope' } });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toMatchObject({ ok: false });
  });
  it('accepts the right token', async () => {
    const { authed } = setup();
    const res = await authed('GET', '/api/verify');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, authed: true });
  });
  it('answers 503 when no token is configured', async () => {
    const { call } = setup();
    const res = await call('/api/verify', { headers: { authorization: 'Bearer anything' } }, null);
    expect(res.status).toBe(503);
    const put = await call('/api/novels/my-novel', { method: 'PUT', body: '{}' }, '');
    expect(put.status).toBe(503);
  });
});

describe('publish validation', () => {
  it('rejects invalid payloads without writing anything', async () => {
    const { store, publish } = setup();
    const bad = book([{ ...chapter('c1', 'published'), blocks: [{ kind: 'choice' }] }]);
    expect((await publish(bad)).status).toBe(400);
    expect(await keys(store)).toEqual([]);
  });
  it('rejects a novel id mismatch', async () => {
    const { store, authed } = setup();
    const res = await authed('PUT', '/api/novels/other', book([chapter('c1', 'published')]));
    expect(res.status).toBe(400);
    expect(await keys(store)).toEqual([]);
  });
  it('rejects bad JSON and duplicate chapters', async () => {
    const { call, publish, store } = setup();
    const res = await call('/api/novels/my-novel', {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN}` },
      body: '{nope',
    });
    expect(res.status).toBe(400);
    const dup = await publish(book([chapter('c1', 'published'), chapter('c1', 'published')]));
    expect(dup.status).toBe(400);
    const wrongSeason = await publish(book([chapter('c1', 'published', 's2')]));
    expect(wrongSeason.status).toBe(400);
    expect(await keys(store)).toEqual([]);
  });
});

describe('lifecycle', () => {
  it('writes published and unlisted, skips drafts', async () => {
    const { publish, read, store } = setup();
    const res = await publish(
      book([
        chapter('a', 'published'),
        chapter('u', 'unlisted'),
        chapter('d', 'draft'),
        chapter('b', 'published'),
      ]),
    );
    expect(await res.json()).toEqual({
      ok: true,
      novelId: 'my-novel',
      publishedChapters: 2,
      unlistedChapters: 1,
      skippedDrafts: 1,
      removedKeys: 0,
      publishedAt: NOW.toISOString(),
      publicListed: true,
    });
    expect(await read('novels/my-novel/seasons/s1/season.json')).toMatchObject({
      id: 's1',
      chapters: ['a', 'b'],
    });
    expect(await store.get('novels/my-novel/seasons/s1/u.json')).not.toBeNull();
    expect(await store.get('novels/my-novel/seasons/s1/d.json')).toBeNull();
    expect(await read('novels/index.json')).toEqual({ novels: ['my-novel'] });
  });

  it('deletes a chapter demoted to draft on republish', async () => {
    const { publish, store } = setup();
    await publish(book([chapter('a', 'published'), chapter('b', 'published')]));
    const res = await publish(book([chapter('a', 'published'), chapter('b', 'draft')]));
    expect(await res.json()).toMatchObject({ removedKeys: 1, skippedDrafts: 1 });
    expect(await store.get('novels/my-novel/seasons/s1/b.json')).toBeNull();
  });

  it('keeps all-unlisted books off the index but readable', async () => {
    const { publish, call, read } = setup();
    const res = await publish(book([chapter('u', 'unlisted')]));
    expect(await res.json()).toMatchObject({ publicListed: false, unlistedChapters: 1 });
    expect(await read('novels/index.json')).toBeUndefined();
    expect((await call('/novels/my-novel/seasons/s1/u.json')).status).toBe(200);
    expect(await read('novels/my-novel/novel.json')).toMatchObject({ seasons: ['s1'] });
  });

  it('preserves other index entries and clears a book with no live chapters', async () => {
    const { publish, store, read } = setup();
    await store.put('novels/index.json', new TextEncoder().encode('{"novels":["zed"]}'), 'x');
    await publish(book([chapter('a', 'published')]));
    expect(await read('novels/index.json')).toEqual({ novels: ['zed', 'my-novel'] });
    const res = await publish(book([chapter('a', 'draft')]));
    expect(await res.json()).toMatchObject({ publicListed: false, removedKeys: 3 });
    expect(await read('novels/index.json')).toEqual({ novels: ['zed'] });
    expect(await store.list('novels/my-novel/')).toEqual([]);
  });

  it('unpublish removes every key and the index entry', async () => {
    const { publish, authed, store, read } = setup();
    await publish(book([chapter('a', 'published')]));
    const res = await authed('DELETE', '/api/novels/my-novel');
    expect(await res.json()).toEqual({ ok: true, novelId: 'my-novel', removedKeys: 3 });
    expect(await store.list('novels/my-novel/')).toEqual([]);
    expect(await read('novels/index.json')).toEqual({ novels: [] });
  });
});

describe('cover', () => {
  const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

  it('stores the cover and references it from novel.json', async () => {
    const { publish, call, read } = setup();
    const res = await publish(
      book([chapter('a', 'published')], { mime: 'image/png', base64: b64(png) }),
    );
    expect(res.status).toBe(200);
    expect(await read('novels/my-novel/novel.json')).toMatchObject({ cover: 'cover.png' });
    const got = await call('/novels/my-novel/cover.png');
    expect(got.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(png);
  });
  it('rejects oversized and unknown covers', async () => {
    const { publish, store } = setup();
    const big = btoa('a'.repeat(MAX_COVER_BYTES + 10));
    const res = await publish(
      book([chapter('a', 'published')], { mime: 'image/png', base64: big }),
    );
    expect(res.status).toBe(413);
    const gif = await publish(
      book([chapter('a', 'published')], { mime: 'image/gif', base64: 'AA==' }),
    );
    expect(gif.status).toBe(400);
    expect(await keys(store)).toEqual([]);
  });
});

describe('http surface', () => {
  it('answers CORS preflight', async () => {
    const { call } = setup();
    const res = await call('/api/novels/x', { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-headers')).toBe('Authorization, Content-Type');
    expect(res.headers.get('access-control-allow-methods')).toBe('GET, PUT, DELETE, OPTIONS');
    expect(res.headers.get('access-control-max-age')).toBe('86400');
  });
  it('serves health with CORS', async () => {
    const { call } = setup();
    const res = await call('/api/health');
    expect(await res.json()).toEqual({ ok: true, version: 1 });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
  it('rejects path traversal and never reads outside novels/', async () => {
    const { call, store } = setup();
    await store.put('secret.json', new TextEncoder().encode('{}'), 'application/json');
    for (const p of [
      '/novels/../secret.json',
      '/novels/%2e%2e/secret.json',
      '/novels/a/..%2fb',
      '/novels/a/%2e%2e%2fsecret.json',
      '/novels/.hidden',
    ]) {
      const res = await call(p);
      expect([400, 404]).toContain(res.status);
    }
    // URL parsing collapses %2e%2e, so that one lands on /secret.json (not under novels/).
    expect((await call('/novels/%2e%2e/secret.json')).status).toBe(404);
    expect((await call('/novels/a/..%2fb')).status).toBe(400);
    expect((await call('/secret.json')).status).toBe(404);
  });
  it('returns 404 on miss and caching headers on hit', async () => {
    const { call, publish } = setup();
    expect((await call('/novels/nope/novel.json')).status).toBe(404);
    await publish(book([chapter('a', 'published')]));
    const res = await call('/novels/my-novel/novel.json');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=60, stale-while-revalidate=300');
    expect(res.headers.get('etag')).toBeTruthy();
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });
  it('405s wrong methods and 404s unknown routes', async () => {
    const { call } = setup();
    expect((await call('/api/health', { method: 'POST' })).status).toBe(405);
    expect((await call('/novels/x/y', { method: 'POST' })).status).toBe(405);
    expect((await call('/nope')).status).toBe(404);
  });
});
