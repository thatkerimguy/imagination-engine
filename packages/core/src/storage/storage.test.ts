import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createMemoryFileStore, splitPath } from './files.ts';
import { createMemoryStore, readParsed } from './kv.ts';

describe('memory key/value store', () => {
  it('stores copies and lists keys by prefix', async () => {
    const store = createMemoryStore();
    const value = { gold: 1 };
    await store.set('save.slot1', value);
    value.gold = 2;
    expect(await store.get('save.slot1')).toEqual({ gold: 1 });
    await store.set('prefs.theme', 'night');
    expect(await store.keys('save.')).toEqual(['save.slot1']);
    await store.delete('save.slot1');
    expect(await store.get('save.slot1')).toBeUndefined();
  });

  it('validates on read', async () => {
    const store = createMemoryStore();
    const schema = z.object({ gold: z.number() });
    await store.set('ok', { gold: 3 });
    await store.set('bad', { gold: 'lots' });
    expect(await readParsed(store, 'ok', schema)).toEqual({ gold: 3 });
    expect(await readParsed(store, 'missing', schema)).toBeUndefined();
    await expect(readParsed(store, 'bad', schema)).rejects.toThrow(/invalid/);
  });
});

describe('memory file store', () => {
  it('writes, reads, lists and deletes files', async () => {
    const files = createMemoryFileStore();
    await files.write('audio/theme.txt', 'hello');
    await files.write('audio/hit.txt', 'x');
    await files.write('top.txt', 'y');
    expect(await (await files.read('audio/theme.txt'))?.text()).toBe('hello');
    expect(await files.list('audio')).toEqual(['hit.txt', 'theme.txt']);
    expect(await files.list()).toEqual(['top.txt']);
    await files.delete('audio/hit.txt');
    expect(await files.read('audio/hit.txt')).toBeUndefined();
  });

  it('rejects unsafe paths', () => {
    expect(() => splitPath('../secret')).toThrow();
    expect(() => splitPath('')).toThrow();
    expect(splitPath('/a//b/')).toEqual(['a', 'b']);
  });
});
