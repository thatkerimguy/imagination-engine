import type { KeyValueStore } from '@ie/core';
import { libraryItemSchema, type LibraryItem } from '@ie/story';
import { create } from 'zustand';
import { projectStore } from '../project/storage.ts';

/*
 * The Library (ADR 0021): reusable items shared by every project on this device, one record per
 * item in the Studio's IndexedDB store (through @ie/core storage), validated on every read.
 */

const PREFIX = 'library:';

/** Every readable item, newest first. Unreadable records are skipped with a warning. */
export async function readLibrary(store: KeyValueStore): Promise<LibraryItem[]> {
  const items: LibraryItem[] = [];
  for (const key of await store.keys(PREFIX)) {
    const parsed = libraryItemSchema.safeParse(await store.get(key));
    if (parsed.success) items.push(parsed.data);
    else console.warn(`Library item ${key} could not be read.`, parsed.error);
  }
  return items.sort((a, b) => b.addedAt - a.addedAt || a.name.localeCompare(b.name));
}

export async function writeItems(
  store: KeyValueStore,
  items: readonly LibraryItem[],
): Promise<void> {
  for (const item of items) await store.set(PREFIX + item.id, item);
}

export async function deleteItem(store: KeyValueStore, id: string): Promise<void> {
  await store.delete(PREFIX + id);
}

interface LibraryState {
  readonly items: readonly LibraryItem[];
  readonly loaded: boolean;
  load: () => Promise<void>;
  add: (items: readonly LibraryItem[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
}

/** The Library as the Studio sees it; every change is written through before the list updates. */
export const useLibrary = create<LibraryState>()((set, get) => ({
  items: [],
  loaded: false,
  load: async () => {
    set({ items: await readLibrary(await projectStore()), loaded: true });
  },
  add: async (items) => {
    await writeItems(await projectStore(), items);
    set({ items: [...items, ...get().items] });
  },
  remove: async (id) => {
    await deleteItem(await projectStore(), id);
    set({ items: get().items.filter((item) => item.id !== id) });
  },
  rename: async (id, name) => {
    const label = name.trim().slice(0, 80);
    const item = get().items.find((i) => i.id === id);
    if (!item || !label || label === item.name) return;
    const next = { ...item, name: label };
    await writeItems(await projectStore(), [next]);
    set({ items: get().items.map((i) => (i.id === id ? next : i)) });
  },
}));
