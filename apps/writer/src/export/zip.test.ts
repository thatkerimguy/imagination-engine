import { describe, expect, it } from 'vitest';
import { crc32 } from './zip-write.ts';
import { bytesOf, textOf, unzipFiles, zipFiles } from './zip.ts';

const MIME = 'application/epub+zip';
const u16 = (b: Uint8Array, at: number): number => b[at]! | (b[at + 1]! << 8);
const u32 = (b: Uint8Array, at: number): number =>
  (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;

describe('zipFiles STORE entries (OCF)', () => {
  const build = (big = false) =>
    zipFiles({
      mimetype: { data: bytesOf(MIME), store: true },
      'META-INF/container.xml': bytesOf('<container/>'),
      'OEBPS/ch.xhtml': bytesOf('x'.repeat(big ? 120_000 : 10)),
    });

  it.each([false, true])('places mimetype byte-exact at offset 0 (large=%s)', async (big) => {
    const z = await build(big);
    expect(u32(z, 0)).toBe(0x04034b50); // local file header at offset 0
    expect(u16(z, 6) & 0x08).toBe(0); // no data descriptor
    expect(u16(z, 8)).toBe(0); // method 0 = STORE
    expect(u32(z, 14)).toBe(crc32(bytesOf(MIME))); // exact CRC
    expect(u32(z, 18)).toBe(20); // compressed size
    expect(u32(z, 22)).toBe(20); // uncompressed size
    expect(u16(z, 26)).toBe(8); // name length
    expect(u16(z, 28)).toBe(0); // extra field length
    expect(textOf(z.slice(30, 38))).toBe('mimetype');
    expect(textOf(z.slice(38, 58))).toBe(MIME);
    expect(MIME.length).toBe(20);
  });

  it('round-trips every entry and deflates the others', async () => {
    const z = await build(true);
    const files = await unzipFiles(z);
    expect(Object.keys(files)).toEqual(['mimetype', 'META-INF/container.xml', 'OEBPS/ch.xhtml']);
    expect(textOf(files.mimetype!)).toBe(MIME);
    expect(files['OEBPS/ch.xhtml']!.length).toBe(120_000);
    expect(z.length).toBeLessThan(10_000);
  });

  it('keeps the plain fflate path when nothing is stored', async () => {
    const z = await zipFiles({ 'a.txt': bytesOf('hello') });
    expect(u16(z, 8)).toBe(8);
    expect(textOf((await unzipFiles(z))['a.txt']!)).toBe('hello');
  });

  it('computes the standard CRC-32', () => {
    expect(crc32(bytesOf('123456789'))).toBe(0xcbf43926);
  });
});
