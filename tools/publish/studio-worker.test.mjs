import { describe, expect, it } from 'vitest';
import worker from './studio-worker.mjs';

/** Just enough of an R2 bucket for the sync routes. */
function bucket() {
  const objects = new Map();
  return {
    objects,
    head: async (key) => (objects.has(key) ? { key } : null),
    get: async (key) => {
      const o = objects.get(key);
      return o ? { body: o.body, httpEtag: '"1"', httpMetadata: o.httpMetadata } : null;
    },
    put: async (key, body, options = {}) => {
      objects.set(key, { body, httpMetadata: options.httpMetadata });
      return { httpEtag: '"1"' };
    },
    list: async () => ({ objects: [], truncated: false }),
  };
}

const assets = { fetch: async () => new Response('asset') };
const access = { 'Cf-Access-Jwt-Assertion': 'token' };

describe('the hosted Studio worker', () => {
  it('serves everything else from the static assets', async () => {
    const res = await worker.fetch(new Request('https://studio.test/write'), { ASSETS: assets });
    expect(await res.text()).toBe('asset');
  });

  it('refuses the audio relay without Access', async () => {
    const res = await worker.fetch(new Request('https://studio.test/fetch?url=x'), {
      ASSETS: assets,
    });
    expect(res.status).toBe(403);
  });

  it('answers a badly encoded sync path with 400, not a crash', async () => {
    const res = await worker.fetch(new Request('https://studio.test/sync/projects/%E0%A4%A'), {
      ASSETS: assets,
      SYNC: bucket(),
      SYNC_OPEN: '1',
    });
    expect(res.status).toBe(400);
  });

  it('stores a song once and gives it back', async () => {
    const env = { ASSETS: assets, SYNC: bucket() };
    const url = 'https://studio.test/sync/files/audio/t_abc.mp3';
    expect(
      (await worker.fetch(new Request(url, { method: 'HEAD', headers: access }), env)).status,
    ).toBe(204);
    const put = await worker.fetch(
      new Request(url, {
        method: 'PUT',
        headers: { ...access, 'Content-Type': 'audio/mpeg' },
        body: 'song',
      }),
      env,
    );
    expect(put.status).toBe(200);
    expect(
      (await worker.fetch(new Request(url, { method: 'HEAD', headers: access }), env)).status,
    ).toBe(200);
    const got = await worker.fetch(new Request(url, { headers: access }), env);
    expect(got.headers.get('Content-Type')).toBe('audio/mpeg');
  });

  it('refuses file names outside audio/', async () => {
    const res = await worker.fetch(
      new Request('https://studio.test/sync/files/projects/x.json', { headers: access }),
      { ASSETS: assets, SYNC: bucket() },
    );
    expect(res.status).toBe(400);
  });
});
