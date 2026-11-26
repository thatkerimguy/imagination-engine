// Typed JSON documents for small writer sidecars, stored as rows of the relational `settings`
// table (see db/settings-adapter.ts). Every document records when it was last written.
import type { StorageAdapter } from '../storage/types.ts';

export interface Stored<T> {
  data: T;
  updatedAt: number;
}

export const keys = {
  setting: (name: string) => `setting/${name}`,
} as const;

export class DocumentStore {
  constructor(
    private readonly adapter: StorageAdapter,
    private readonly now: () => number = Date.now,
  ) {}

  async read<T>(key: string): Promise<Stored<T> | null> {
    const raw = await this.adapter.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as Stored<T>;
    } catch {
      return null;
    }
  }

  async write<T>(key: string, data: T): Promise<number> {
    const updatedAt = this.now();
    await this.adapter.set(key, JSON.stringify({ data, updatedAt } satisfies Stored<T>));
    return updatedAt;
  }

  remove(key: string): Promise<void> {
    return this.adapter.remove(key);
  }

  keys(prefix: string): Promise<string[]> {
    return this.adapter.keys(prefix);
  }
}
