import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogToTrack, publishability, searchAudius, searchOpenverse } from './catalog.ts';

const reply = (body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body)));

afterEach(() => vi.restoreAllMocks());

describe('catalogues', () => {
  it('reads Openverse results with their licences', async () => {
    reply({
      results: [
        {
          id: 'abc',
          title: 'Rain',
          creator: 'Someone',
          url: 'https://prod-1.storage.jamendo.com/?trackid=1&format=mp32',
          foreign_landing_url: 'https://www.jamendo.com/track/1',
          license: 'by-sa',
          license_version: '3.0',
          license_url: 'https://creativecommons.org/licenses/by-sa/3.0/',
          attribution: '"Rain" by Someone',
          duration: 208000,
          extra: 'ignored',
        },
      ],
    });
    const [track] = await searchOpenverse('rain');
    expect(track).toMatchObject({
      provider: 'openverse',
      title: 'Rain',
      duration: 208,
      license: { code: 'cc-by-sa-3.0', attribution: '"Rain" by Someone' },
    });
    const lib = catalogToTrack(track!, 't_rain');
    expect(lib.source).toEqual({
      kind: 'url',
      url: 'https://prod-1.storage.jamendo.com/?trackid=1&format=mp32',
      provider: 'openverse',
      page: 'https://www.jamendo.com/track/1',
    });
  });

  it('skips Audius tracks that cannot stream', async () => {
    reply({
      data: [
        {
          id: 'a',
          title: 'One',
          duration: 71,
          is_streamable: true,
          user: { name: 'A', handle: 'a' },
        },
        { id: 'b', title: 'Two', is_streamable: false, user: { name: 'B', handle: 'b' } },
      ],
    });
    const found = await searchAudius('lofi');
    expect(found.map((t) => t.id)).toEqual(['a']);
    expect(found[0]?.streamUrl).toContain('/v1/tracks/a/stream');
  });

  it('rates licences for publishing', () => {
    expect(publishability('cc0-1.0')).toBe('ok');
    expect(publishability('cc-by-4.0')).toBe('credit');
    expect(publishability('cc-by-sa-3.0')).toBe('caution');
    expect(publishability('cc-by-nc-nd-3.0')).toBe('private');
    expect(publishability('unknown')).toBe('private');
  });
});
