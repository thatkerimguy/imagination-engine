import { describe, expect, it } from 'vitest';
import chapter from '../../../../sample-novels/vertical-slice/seasons/s01/ch01.json';
import season from '../../../../sample-novels/vertical-slice/seasons/s01/season.json';
import novel from '../../../../sample-novels/vertical-slice/novel.json';
import { parseHostControl, parsePreviewLoad } from './protocol.ts';

const load = (extra: Record<string, unknown> = {}, ch: unknown = chapter) => ({
  type: 'kn-preview-load',
  novel,
  season,
  chapter: ch,
  ...extra,
});

describe('parsePreviewLoad', () => {
  it('returns null for non-preview messages and invalid JSON strings', () => {
    expect(parsePreviewLoad({ type: 'other' })).toBeNull();
    expect(parsePreviewLoad(null)).toBeNull();
    expect(parsePreviewLoad(5)).toBeNull();
    expect(parsePreviewLoad('{nope')).toBeNull();
    expect(parsePreviewLoad(JSON.stringify({ type: 'x' }))).toBeNull();
  });

  it('accepts a valid load in object and string form', () => {
    const res = parsePreviewLoad(load({ tier: 'lite', startBlockId: 'abc' }));
    expect(res?.ok).toBe(true);
    if (res?.ok) {
      expect(res.load.tier).toBe('lite');
      expect(res.load.startBlockId).toBe('abc');
      expect(res.load.chapter.id).toBe('ch01');
    }
    expect(parsePreviewLoad(JSON.stringify(load()))?.ok).toBe(true);
  });

  it("defaults tier to 'auto' on a bad value and startBlockId to null", () => {
    const res = parsePreviewLoad(load({ tier: 'ultra' }));
    expect(res?.ok).toBe(true);
    if (res?.ok) {
      expect(res.load.tier).toBe('auto');
      expect(res.load.startBlockId).toBeNull();
    }
  });

  it("returns errors prefixed with 'chapter ' for an invalid chapter", () => {
    const bad = {
      ...chapter,
      blocks: [{ id: '01M7WD7TG2E6A9YY5JE036YWV9', kind: 'prose', text: '' }],
    };
    const res = parsePreviewLoad(load({}, bad));
    expect(res).not.toBeNull();
    expect(res?.ok).toBe(false);
    if (res && !res.ok) {
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.errors.every((e) => e.startsWith('chapter '))).toBe(true);
    }
  });
});

describe('parseHostControl', () => {
  it('accepts lifecycle and a11y messages in object and string form', () => {
    expect(parseHostControl({ type: 'lifecycle', state: 'background' })).toEqual({
      type: 'lifecycle',
      state: 'background',
    });
    expect(parseHostControl(JSON.stringify({ type: 'lifecycle', state: 'active' }))).toEqual({
      type: 'lifecycle',
      state: 'active',
    });
    expect(parseHostControl({ type: 'a11y', reducedMotion: true })).toEqual({
      type: 'a11y',
      reducedMotion: true,
    });
  });

  it('rejects malformed control messages and chapter loads', () => {
    expect(parseHostControl({ type: 'lifecycle', state: 'paused' })).toBeNull();
    expect(parseHostControl({ type: 'a11y', reducedMotion: 'yes' })).toBeNull();
    expect(parseHostControl({ type: 'record', on: true })).toEqual({ type: 'record', on: true });
    expect(parseHostControl('{"type":"record","on":false}')).toEqual({ type: 'record', on: false });
    expect(parseHostControl({ type: 'record', on: 'yes' })).toBeNull();
    expect(parseHostControl(load())).toBeNull();
    expect(parseHostControl('{nope')).toBeNull();
    expect(parseHostControl(null)).toBeNull();
    expect(parsePreviewLoad({ type: 'lifecycle', state: 'active' })).toBeNull();
  });
  it('accepts live Visual DNA pushes (id or object) and rejects empty ones', () => {
    expect(parseHostControl({ type: 'dna', dna: 'noir-rain' })).toEqual({
      type: 'dna',
      dna: 'noir-rain',
    });
    expect(parseHostControl('{"type":"dna","dna":{"a":1}}')).toEqual({
      type: 'dna',
      dna: { a: 1 },
    });
    expect(parseHostControl({ type: 'dna' })).toBeNull();
    expect(parseHostControl({ type: 'dna', dna: null })).toBeNull();
  });
});
