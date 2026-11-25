import { describe, expect, it } from 'vitest';
import { MOD, TOKEN, setup } from './test-helpers.ts';

const valid = { novelSlug: 'my-novel', chapterSlug: 'c1', reason: 'spam', details: 'bad' };

describe('POST /api/reports', () => {
  it('persists a report without the raw ip', async () => {
    const { report, publish, store } = setup();
    await publish();
    const res = await report(valid, { 'cf-connecting-ip': '203.0.113.9' });
    expect(res.status).toBe(201);
    const { ok, reportId } = (await res.json()) as { ok: boolean; reportId: string };
    expect(ok).toBe(true);
    const keys = await store.list('reports/pending/');
    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe(`reports/pending/2026-01-02T03-04-05-678Z-${reportId}.json`);
    const raw = new TextDecoder().decode((await store.get(keys[0] ?? ''))?.body);
    expect(raw).not.toContain('203.0.113.9');
    expect(JSON.parse(raw)).toMatchObject({
      id: reportId,
      ...valid,
      createdAt: expect.any(String),
    });
    expect(JSON.parse(raw).ipHash).toMatch(/^[0-9a-f]{16}$/);
  });
  it('rejects unknown novel, bad reason, long details, bad json', async () => {
    const { report, publish, call } = setup();
    await publish();
    expect((await report({ ...valid, novelSlug: 'ghost' })).status).toBe(404);
    expect((await report({ ...valid, reason: 'nope' })).status).toBe(400);
    expect((await report({ ...valid, details: 'x'.repeat(1001) })).status).toBe(400);
    expect((await report({ ...valid, details: 'x'.repeat(1000) })).status).toBe(201);
    const bad = await call('/api/reports', { method: 'POST', body: '{' });
    expect(bad.status).toBe(400);
    const big = await call('/api/reports', {
      method: 'POST',
      headers: { 'cf-connecting-ip': '7.7.7.7' },
      body: 'x'.repeat(9000),
    });
    expect(big.status).toBe(413);
  });
  it('accepts the html form post and answers with escaped html', async () => {
    const { call, publish, store } = setup();
    await publish();
    const res = await call('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'novelSlug=my-novel&chapterSlug=&reason=hate&details=%3Cb%3E',
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('Report received');
    const keys = await store.list('reports/pending/');
    const rec = JSON.parse(new TextDecoder().decode((await store.get(keys[0] ?? ''))?.body));
    expect(rec).toMatchObject({ reason: 'hate', details: '<b>' });
    expect(rec.chapterSlug).toBeUndefined();
    const bad = await call('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'novelSlug=my-novel&reason=zzz',
    });
    expect(bad.status).toBe(400);
    expect(bad.headers.get('content-type')).toContain('text/html');
  });
  it('allows POST in CORS preflight', async () => {
    const res = await setup().call('/api/reports', { method: 'OPTIONS' });
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });
  it('is not publicly readable under /novels', async () => {
    const { report, publish, call } = setup();
    await publish();
    await report(valid);
    expect((await call('/reports/pending/x.json')).status).toBe(404);
    expect((await call('/novels/reports/pending/x.json')).status).toBe(404);
  });
});

describe('rate limits', () => {
  it('429s the 6th report in a window and recovers after it', async () => {
    let t = 0;
    const { report, publish } = setup({}, () => t);
    await publish();
    const h = { 'cf-connecting-ip': '1.1.1.1' };
    for (let i = 0; i < 5; i++) expect((await report(valid, h)).status).toBe(201);
    const limited = await report(valid, h);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('60');
    expect(await limited.json()).toEqual({ ok: false, error: 'Too many requests' });
    expect((await report(valid, { 'cf-connecting-ip': '2.2.2.2' })).status).toBe(201);
    t = 61_000;
    expect((await report(valid, h)).status).toBe(201);
  });
  it('limits publishing to 30 per window and uses x-forwarded-for', async () => {
    const { call } = setup();
    const del = () =>
      call('/api/novels/a', {
        method: 'DELETE',
        headers: { authorization: `Bearer ${TOKEN}`, 'x-forwarded-for': '9.9.9.9, 10.0.0.1' },
      });
    for (let i = 0; i < 30; i++) expect((await del()).status).toBe(200);
    const limited = await del();
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('60');
  });
});

describe('moderation', () => {
  it('lists reports and resolves one on takedown', async () => {
    const { report, publish, withToken, store } = setup();
    await publish();
    const { reportId } = (await (await report(valid)).json()) as { reportId: string };
    const list = await withToken(MOD, 'GET', '/api/moderation/reports');
    const body = (await list.json()) as { ok: boolean; reports: Array<{ id: string }> };
    expect(body.reports.map((r) => r.id)).toEqual([reportId]);
    const res = await withToken(MOD, 'POST', '/api/moderation/takedown', {
      novelSlug: 'my-novel',
      reason: 'spam',
      reportId,
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { removedKeys: number }).removedKeys).toBeGreaterThan(0);
    expect(await store.list('reports/pending/')).toEqual([]);
    expect(await store.list('reports/resolved/')).toHaveLength(1);
    const tomb = await store.get('takedowns/my-novel.json');
    expect(JSON.parse(new TextDecoder().decode(tomb?.body))).toMatchObject({
      novelSlug: 'my-novel',
      reportId,
      takenDownAt: '2026-01-02T03:04:05.678Z',
    });
    expect(await store.list('novels/my-novel/')).toEqual([]);
  });
  it('validates the takedown body', async () => {
    const { withToken } = setup();
    expect(
      (await withToken(MOD, 'POST', '/api/moderation/takedown', { novelSlug: 'A!' })).status,
    ).toBe(400);
    const long = { novelSlug: 'ok', reason: 'x'.repeat(501) };
    expect((await withToken(MOD, 'POST', '/api/moderation/takedown', long)).status).toBe(400);
  });
});
