import { createMemoryStore } from '@ie/core';
import { libraryItem } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { deleteItem, readLibrary, writeItems } from './storage.ts';

describe('library storage', () => {
  it('keeps items newest first, skips unreadable records and deletes by ID', async () => {
    const store = createMemoryStore();
    const old = libraryItem({ kind: 'theme', data: { preset: 'noir' } }, 'Noir', 1);
    const fresh = libraryItem({ kind: 'effect', data: { action: 'stage.flash' } }, 'Flash', 2);
    await writeItems(store, [old, fresh]);
    await store.set('library:broken', { kind: 'theme', data: { preset: 'nope' } });
    await store.set('project:other', { not: 'an item' });

    expect((await readLibrary(store)).map((i) => i.name)).toEqual(['Flash', 'Noir']);
    await deleteItem(store, fresh.id);
    expect((await readLibrary(store)).map((i) => i.id)).toEqual([old.id]);
  });
});
