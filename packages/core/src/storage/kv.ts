import { openDB } from 'idb';
import { z } from 'zod';

/** Async key/value storage. Values must be structured-cloneable; validate them on read. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
}

export function createMemoryStore(): KeyValueStore {
  const data = new Map<string, unknown>();
  return {
    get: (key) => Promise.resolve(data.has(key) ? structuredClone(data.get(key)) : undefined),
    set: (key, value) => {
      data.set(key, structuredClone(value));
      return Promise.resolve();
    },
    delete: (key) => {
      data.delete(key);
      return Promise.resolve();
    },
    keys: (prefix = '') => Promise.resolve([...data.keys()].filter((k) => k.startsWith(prefix))),
  };
}

export function isIndexedDbSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

/** Opens (or creates) an IndexedDB-backed store. One object store per name. */
export async function openIndexedDbStore(
  dbName = 'imagination',
  storeName = 'kv',
): Promise<KeyValueStore> {
  const db = await openDB(dbName, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName);
    },
  });
  return {
    get: (key) => db.get(storeName, key) as Promise<unknown>,
    set: async (key, value) => {
      await db.put(storeName, value, key);
    },
    delete: (key) => db.delete(storeName, key),
    keys: async (prefix = '') => {
      const all = await db.getAllKeys(storeName);
      return all.map(String).filter((k) => k.startsWith(prefix));
    },
  };
}

/** Reads a value and validates it, so corrupt or outdated data fails loudly instead of silently. */
export async function readParsed<S extends z.ZodType>(
  store: KeyValueStore,
  key: string,
  schema: S,
): Promise<z.output<S> | undefined> {
  const raw = await store.get(key);
  if (raw === undefined) return undefined;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Stored value "${key}" is invalid:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
