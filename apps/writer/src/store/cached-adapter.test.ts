import { describe, expect, it, vi } from 'vitest';
import type { StorageAdapter } from '../storage/types.ts';
import { CachedAdapter } from './cached-adapter.ts';

function memory(): StorageAdapter & { keys: ReturnType<typeof vi.fn> } {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
    remove: async (k) => void m.delete(k),
    keys: vi.fn(async (prefix: string) => [...m.keys()].filter((k) => k.startsWith(prefix))),
  };
}

describe('CachedAdapter key lists', () => {
  it('serves a repeated keys(prefix) from cache', async () => {
    const inner = memory();
    await inner.set('a/1', 'x');
    const c = new CachedAdapter(inner);
    expect(await c.keys('a/')).toEqual(['a/1']);
    expect(await c.keys('a/')).toEqual(['a/1']);
    expect(inner.keys).toHaveBeenCalledTimes(1);
  });

  it('invalidates covering prefixes on set and remove of a key', async () => {
    const inner = memory();
    const c = new CachedAdapter(inner);
    expect(await c.keys('a/')).toEqual([]);
    expect(await c.keys('b/')).toEqual([]);
    await c.set('a/2', 'y');
    expect(await c.keys('a/')).toEqual(['a/2']);
    await c.keys('b/');
    expect(inner.keys).toHaveBeenCalledTimes(3); // b/ stayed cached
    await c.remove('a/2');
    expect(await c.keys('a/')).toEqual([]);
  });

  it('does not let callers mutate the cached list', async () => {
    const c = new CachedAdapter(memory());
    (await c.keys('a/')).push('zzz');
    expect(await c.keys('a/')).toEqual([]);
  });

  it('clear() drops cached key lists', async () => {
    const inner = memory();
    const c = new CachedAdapter(inner);
    await c.keys('a/');
    c.clear();
    await c.keys('a/');
    expect(inner.keys).toHaveBeenCalledTimes(2);
  });
});
