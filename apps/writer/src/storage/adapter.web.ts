// Expo Web (QA / Playwright): localStorage, falling back to memory when storage is blocked.
import { createMemoryAdapter } from './memory.ts';
import type { StorageAdapter } from './types.ts';

const NS = 'kn-writer:';

export function createDefaultAdapter(): StorageAdapter {
  let ls: Storage;
  try {
    ls = globalThis.localStorage;
    ls.setItem(`${NS}probe`, '1');
    ls.removeItem(`${NS}probe`);
  } catch {
    return createMemoryAdapter();
  }
  return {
    get: async (key) => ls.getItem(NS + key),
    set: async (key, value) => ls.setItem(NS + key, value),
    remove: async (key) => ls.removeItem(NS + key),
    async keys(prefix) {
      const out: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k?.startsWith(NS + prefix)) out.push(k.slice(NS.length));
      }
      return out.sort();
    },
  };
}
