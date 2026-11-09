import { describe, expect, it } from 'vitest';
import { createId } from './ids.ts';

describe('createId', () => {
  it('creates prefixed base62 ids of the requested length', () => {
    expect(createId('psg')).toMatch(/^psg_[0-9A-Za-z]{10}$/);
    expect(createId('', 16)).toMatch(/^[0-9A-Za-z]{16}$/);
  });

  it('does not repeat in practice', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => createId()));
    expect(ids.size).toBe(5000);
  });

  it('rejects tiny lengths', () => {
    expect(() => createId('x', 2)).toThrow(RangeError);
  });
});
