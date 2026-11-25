import { describe, expect, it } from 'vitest';
import { normaliseFingerprints } from './assetlinks.ts';
import { renderOgCard } from './og-image.ts';
import { MOD, TOKEN, setup } from './test-helpers.ts';

const dec = new TextDecoder();
const FP = 'ab'.repeat(32);
const FP_COLON = Array(32).fill('AB').join(':');

describe('og image', () => {
  it('serves a valid 1200x630 PNG', async () => {
    const { call, publish } = setup();
    await publish();
    const t0 = performance.now();
    const res = await call('/og/my-novel.png');
    expect(performance.now() - t0).toBeLessThan(500);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(16)).toBe(1200);
    expect(view.getUint32(20)).toBe(630);
    expect(bytes[24]).toBe(8);
    expect(bytes[25]).toBe(3);
    expect(dec.decode(bytes.slice(37, 41))).toBe('PLTE');
    expect(dec.decode(bytes.slice(bytes.length - 8, bytes.length - 4))).toBe('IEND');
  });
  it('404s for an unknown slug', async () => {
    const { call } = setup();
    expect((await call('/og/nope.png')).status).toBe(404);
  });
  it('differs per slug and ignores bad accent colours', () => {
    const a = renderOgCard('one', [200, 80, 60]);
    const b = renderOgCard('two', [200, 80, 60]);
    expect(a.pixels).not.toEqual(b.pixels);
    expect(a.palette.length).toBeLessThanOrEqual(256 * 3);
    expect(a.pixels.reduce((m, v) => Math.max(m, v), 0)).toBeLessThan(a.palette.length / 3);
  });
});

describe('share page', () => {
  it('escapes hostile title and subtitle', async () => {
    const { call, publish } = setup({ readerUrl: 'https://reader.test/' });
    await publish('my-novel', {
      title: '</title><script>alert(1)</script>',
      subtitle: '"quoted" <img onerror=alert(1)>',
    });
    const res = await call('/share/my-novel');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    const html = await res.text();
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;/title&gt;&lt;script&gt;');
    expect(html).toContain('&quot;quoted&quot;');
    expect(html).toContain('og:image" content="http://x.test/og/my-novel.png"');
    expect(html).toContain('~1 min read');
    expect(html).toContain('url=https://reader.test/?novel=my-novel');
    expect((await call('/r/my-novel')).status).toBe(200);
  });
  it('does not redirect without a reader url, 404 unknown', async () => {
    const { call, publish } = setup();
    await publish();
    expect(await (await call('/share/my-novel')).text()).not.toContain('http-equiv');
    expect((await call('/share/nope')).status).toBe(404);
  });
});

describe('takedown', () => {
  it('410s everywhere until the tombstone is cleared', async () => {
    const { call, publish, withToken } = setup();
    await publish();
    const res = await withToken(MOD, 'POST', '/api/moderation/takedown', {
      novelSlug: 'my-novel',
      reason: 'illegal',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, novelSlug: 'my-novel' });
    for (const p of ['/novels/my-novel/novel.json', '/share/my-novel', '/og/my-novel.png']) {
      expect((await call(p)).status).toBe(410);
    }
    expect((await call('/novels/my-novel/novel.json', { method: 'HEAD' })).status).toBe(410);
    const put = await publish();
    expect(put.status).toBe(410);
    expect(await put.json()).toEqual({
      ok: false,
      error: 'This novel was taken down by moderation',
    });
    expect((await withToken(MOD, 'DELETE', '/api/moderation/takedown/my-novel')).status).toBe(200);
    expect((await publish()).status).toBe(200);
  });
  it('tombstones are not publicly readable', async () => {
    const { call, publish, withToken } = setup();
    await publish();
    await withToken(MOD, 'POST', '/api/moderation/takedown', {
      novelSlug: 'my-novel',
      reason: 'x',
    });
    expect((await call('/takedowns/my-novel.json')).status).toBe(404);
    expect((await call('/novels/..%2Ftakedowns/my-novel.json')).status).toBe(400);
  });
});

describe('assetlinks', () => {
  it('is [] when unset and formatted when set', async () => {
    expect(await (await setup().call('/.well-known/assetlinks.json')).json()).toEqual([]);
    const { call } = setup({
      androidCertFingerprints: ` ${FP} , nonsense,${FP_COLON.toLowerCase()}`,
    });
    const res = await call('/.well-known/assetlinks.json');
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(await res.json()).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'dev.kinetic.writer',
          sha256_cert_fingerprints: [FP_COLON],
        },
      },
    ]);
    expect(normaliseFingerprints(undefined)).toEqual([]);
  });
});

describe('legal pages', () => {
  it('serves static html with strict headers', async () => {
    const { call } = setup();
    for (const p of ['terms', 'privacy', 'takedown']) {
      const res = await call(`/legal/${p}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(await res.text()).not.toContain('<script');
    }
    expect(await (await call('/legal/terms')).text()).toContain('2026-11');
  });
  it('escapes the prefilled novel', async () => {
    const html = await (await setup().call('/legal/takedown?novel=%22%3E%3Cscript%3E')).text();
    expect(html).not.toContain('<script>');
    expect(html).toContain('value="&quot;&gt;&lt;script&gt;"');
    expect(html).toContain('action="/api/reports"');
  });
});

describe('moderation auth', () => {
  it('503 unset, 401 wrong or publish token', async () => {
    const off = setup({ moderationToken: '' });
    expect((await off.withToken(MOD, 'GET', '/api/moderation/reports')).status).toBe(503);
    const { withToken, call } = setup();
    expect((await call('/api/moderation/reports')).status).toBe(401);
    expect((await withToken('bad', 'GET', '/api/moderation/reports')).status).toBe(401);
    expect((await withToken(TOKEN, 'GET', '/api/moderation/reports')).status).toBe(401);
  });
});
