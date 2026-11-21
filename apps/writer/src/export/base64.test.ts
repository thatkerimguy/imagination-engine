import { describe, expect, it } from 'vitest';
import { bytesToBase64, textToBase64 } from './base64.ts';

const ref = (b: Uint8Array): string => Buffer.from(b).toString('base64');

describe('bytesToBase64', () => {
  it('matches Buffer for every padding case', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 6]) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 97 + 13) & 255);
      expect(bytesToBase64(b)).toBe(ref(b));
    }
  });

  it('encodes multi-megabyte buffers across chunk boundaries without overflowing', () => {
    const b = new Uint8Array(3 * 1024 * 1024 + 7);
    for (let i = 0; i < b.length; i++) b[i] = (i * 31) & 255;
    expect(bytesToBase64(b)).toBe(ref(b));
  });

  it('encodes UTF-8 text', () => {
    const s = 'Snake eyes — “held” ✦ 🎲';
    expect(textToBase64(s)).toBe(Buffer.from(s, 'utf8').toString('base64'));
  });
});
