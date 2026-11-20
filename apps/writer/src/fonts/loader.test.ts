import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CustomFont } from '../store/writer-prefs.ts';
import { addFont, findFont, newCustomFontId, removeFont } from './registry.ts';
import {
  checkFontSize,
  extensionFormat,
  fontFormatFromHeader,
  MAX_WEB_FONT_BYTES,
  validateFontFile,
} from './validate.ts';

const bytes = (...b: number[]): Uint8Array => new Uint8Array(b);
const ascii = (s: string): Uint8Array => bytes(...[...s].map((c) => c.charCodeAt(0)));
const font = (id: string): CustomFont => ({
  id,
  displayName: id,
  uri: 'file:///x.ttf',
  format: 'ttf',
  addedAt: 1,
});

describe('font header detection', () => {
  it('accepts TrueType, true and OTTO headers', () => {
    expect(fontFormatFromHeader(bytes(0, 1, 0, 0, 9))).toBe('ttf');
    expect(fontFormatFromHeader(ascii('true'))).toBe('ttf');
    expect(fontFormatFromHeader(ascii('OTTO'))).toBe('otf');
  });
  it('rejects PNG, random and short data', () => {
    expect(fontFormatFromHeader(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
    expect(fontFormatFromHeader(bytes(1, 2, 3, 4))).toBeNull();
    expect(fontFormatFromHeader(bytes(0, 1))).toBeNull();
  });
});

describe('extension and validation', () => {
  it('maps extensions case-insensitively', () => {
    expect(extensionFormat('A.TTF')).toBe('ttf');
    expect(extensionFormat('b.otf')).toBe('otf');
    expect(extensionFormat('c.woff2')).toBeNull();
  });
  it('uses the header format even when the extension disagrees', () => {
    expect(validateFontFile('x.ttf', ascii('OTTO'))).toBe('otf');
  });
  it('rejects bad extension or bad bytes with a friendly error', () => {
    expect(() => validateFontFile('x.png', bytes(0, 1, 0, 0))).toThrow(/\.ttf or \.otf/);
    expect(() => validateFontFile('x.ttf', bytes(0x89, 0x50, 0x4e, 0x47))).toThrow(/valid/);
  });
});

describe('size cap', () => {
  it('allows up to 2 MB and rejects empty or larger', () => {
    expect(checkFontSize(new Uint8Array(MAX_WEB_FONT_BYTES))).toBeNull();
    expect(checkFontSize(new Uint8Array(MAX_WEB_FONT_BYTES + 1))).toMatch(/2 MB/);
    expect(checkFontSize(new Uint8Array(0))).toMatch(/empty/);
  });
});

describe('registry', () => {
  it('adds, finds and removes without mutating', () => {
    const a = font('custom-font-a');
    const list = [a];
    const next = addFont(list, font('custom-font-b'));
    expect(list).toHaveLength(1);
    expect(next.map((f) => f.id)).toEqual(['custom-font-a', 'custom-font-b']);
    expect(findFont(next, 'custom-font-b')?.id).toBe('custom-font-b');
    expect(removeFont(next, 'custom-font-a').map((f) => f.id)).toEqual(['custom-font-b']);
  });
  it('never overwrites an existing id and mints unique prefixed ids', () => {
    const a = font('custom-font-a');
    expect(addFont([a], { ...a, displayName: 'changed' })[0]?.displayName).toBe('custom-font-a');
    const ids = new Set([newCustomFontId(), newCustomFontId()]);
    expect(ids.size).toBe(2);
    expect([...ids].every((i) => i.startsWith('custom-font-'))).toBe(true);
  });
});

describe('catalog source', () => {
  const src = readFileSync(new URL('./catalog.ts', import.meta.url), 'utf8');
  it('only requires individual weight subpaths, never package roots', () => {
    const specs = [...src.matchAll(/['"](@expo-google-fonts\/[^'"]+)['"]/g)].map((m) => m[1]!);
    expect(specs.length).toBeGreaterThanOrEqual(20);
    for (const s of specs) expect(s).toMatch(/\/\d{3}Regular(_Italic)?\/[^/]+\.ttf$/);
  });
  it('contains the default font id', () => {
    expect(src).toContain("'classic-serif'");
  });
});
