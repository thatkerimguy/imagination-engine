// Native (iOS / Android): one SQLite table of JSON documents, opened lazily.
import * as SQLite from 'expo-sqlite';
import type { StorageAdapter } from './types.ts';

type Db = SQLite.SQLiteDatabase;

export function createDefaultAdapter(): StorageAdapter {
  let opening: Promise<Db> | null = null;
  const db = (): Promise<Db> => {
    opening ??= SQLite.openDatabaseAsync('kinetic-writer.db').then(async (d) => {
      await d.execAsync(
        'PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL);',
      );
      return d;
    });
    return opening;
  };
  return {
    async get(key) {
      const row = await (
        await db()
      ).getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
      return row?.value ?? null;
    },
    async set(key, value) {
      await (
        await db()
      ).runAsync(
        'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
        key,
        value,
        Date.now(),
      );
    },
    async remove(key) {
      await (await db()).runAsync('DELETE FROM kv WHERE key = ?', key);
    },
    async keys(prefix) {
      const rows = await (
        await db()
      ).getAllAsync<{ key: string }>(
        'SELECT key FROM kv WHERE substr(key, 1, ?) = ? ORDER BY key',
        prefix.length,
        prefix,
      );
      return rows.map((r) => r.key);
    },
  };
}
