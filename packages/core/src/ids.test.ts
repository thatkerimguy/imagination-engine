import { describe, expect, it } from 'vitest';
import { isUlid, ulid } from './ids.ts';

describe('ulid', () => {
  it('generates valid, time-sortable ids', () => {
    const a = ulid(1_000);
    const b = ulid(2_000);
    expect(isUlid(a) && isUlid(b)).toBe(true);
    expect(a < b).toBe(true);
  });

  it('rejects index-like and lowercase ids', () => {
    expect(isUlid('0')).toBe(false);
    expect(isUlid(ulid().toLowerCase())).toBe(false);
  });
});
