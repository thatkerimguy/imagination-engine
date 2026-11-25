import { describe, expect, it } from 'vitest';
import {
  base64ByteLength,
  createCoverReader,
  mimeFromExtension,
  parseDataUriCover,
  sniffMime,
} from './cover-data.ts';
import { readCover as readCoverWeb } from './read-cover.web.ts';

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const WEBP = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

describe('cover-data', () => {
  it('sniffs magic bytes and extensions', () => {
    expect(sniffMime(PNG)).toBe('image/png');
    expect(sniffMime('/9j/4AAQ')).toBe('image/jpeg');
    expect(sniffMime(WEBP)).toBe('image/webp');
    expect(sniffMime('R0lGODlh')).toBeNull();
    expect(mimeFromExtension('file:///a/b.JPEG')).toBe('image/jpeg');
    expect(mimeFromExtension('file:///a/b.heic')).toBeNull();
    expect(base64ByteLength('QUJD')).toBe(3);
    expect(base64ByteLength('QUI=')).toBe(2);
  });

  it('passes data: URIs through and rejects unsupported formats calmly', () => {
    expect(parseDataUriCover(`data:image/png;base64,${PNG}`)).toEqual({
      mime: 'image/png',
      base64: PNG,
    });
    expect(parseDataUriCover('data:image/gif;base64,R0lGODlh')).toMatchObject({
      warning: expect.stringMatching(/JPEG, PNG or WebP/),
    });
    expect(parseDataUriCover('blob:abc')).toBeNull();
  });

  it('web reader skips non-data URIs; native reader uses the extension when bytes are unknown', async () => {
    expect(await readCoverWeb('file:///doc/covers/a.png')).toBeNull();
    expect(await readCoverWeb(`data:image/webp;base64,${WEBP}`)).toMatchObject({
      mime: 'image/webp',
    });
    const native = createCoverReader(async () => 'AAAA');
    expect(await native('file:///doc/c.webp')).toEqual({ mime: 'image/webp', base64: 'AAAA' });
    expect(await native('https://x.test/c.png')).toBeNull();
  });
});
