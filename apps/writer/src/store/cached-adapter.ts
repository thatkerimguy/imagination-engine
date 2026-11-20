// In-memory read-through cache over the key-value adapter. Every write made through it updates
// the cache in the same step, so screens switching between Library, Outline and the Chapter
// Editor read from memory instead of flashing a blank frame while SQLite answers.
// Writers that bypass it (Document Doctor's own adapter) must call `clear()` afterwards.
import type { StorageAdapter } from '../storage/types.ts';

export class CachedAdapter implements StorageAdapter {
  private readonly cache = new Map<string, string | null>();

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
    } catch (err) {
      this.cache.delete(key);
      throw err;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.inner.remove(key);
      this.cache.set(key, null);
    } catch (err) {
      this.cache.delete(key);
      throw err;
    }
  }

  keys(prefix: string): Promise<string[]> {
    return this.inner.keys(prefix);
  }

  /** Drops every cached value (after a restore or repair that wrote around this adapter). */
  clear(): void {
    this.cache.clear();
  }

  /** Number of cached keys (tests and diagnostics). */
  get size(): number {
    return this.cache.size;
  }
}
