// In-memory read-through cache over the key-value adapter. Every write made through it updates
// the cache in the same step, so screens switching between Library, Outline and the Chapter
// Editor read from memory instead of flashing a blank frame while SQLite answers.
// Writers that bypass it (Document Doctor's own adapter) must call `clear()` afterwards.
import type { StorageAdapter } from '../storage/types.ts';

export class CachedAdapter implements StorageAdapter {
  private readonly cache = new Map<string, string | null>();
  private readonly keyLists = new Map<string, string[]>();
  /** Bumped on every invalidation so a keys() read that raced a write is not cached. */
  private epoch = 0;

  constructor(private readonly inner: StorageAdapter) {}

  async get(key: string): Promise<string | null> {
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    const value = await this.inner.get(key);
    this.cache.set(key, value);
    return value;
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this.inner.set(key, value);
      this.cache.set(key, value);
      this.invalidateKeys(key);
    } catch (err) {
      this.cache.delete(key);
      this.invalidateKeys(key);
      throw err;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.inner.remove(key);
      this.cache.set(key, null);
      this.invalidateKeys(key);
    } catch (err) {
      this.cache.delete(key);
      this.invalidateKeys(key);
      throw err;
    }
  }

  async keys(prefix: string): Promise<string[]> {
    const hit = this.keyLists.get(prefix);
    if (hit) return [...hit];
    const epoch = this.epoch;
    const list = await this.inner.keys(prefix);
    if (epoch === this.epoch) this.keyLists.set(prefix, [...list]);
    return list;
  }

  /** Drops every cached key list whose prefix covers `key`. */
  private invalidateKeys(key: string): void {
    this.epoch++;
    for (const prefix of this.keyLists.keys()) {
      if (key.startsWith(prefix)) this.keyLists.delete(prefix);
    }
  }

  /** Drops every cached value (after a restore or repair that wrote around this adapter). */
  clear(): void {
    this.cache.clear();
    this.keyLists.clear();
    this.epoch++;
  }

  /** Number of cached keys (tests and diagnostics). */
  get size(): number {
    return this.cache.size;
  }
}
