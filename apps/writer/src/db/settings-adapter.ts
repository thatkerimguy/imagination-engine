// Small writer sidecars (app settings, item meta, chapter styles, version history, publish and
// lock config) are JSON documents in the relational `settings` table. This exposes that table
// through the key-value StorageAdapter contract that `DocumentStore` reads and writes.
import type { StorageAdapter } from '../storage/types.ts';
import type { DatabasePort } from './port.ts';

export function settingsAdapter(db: DatabasePort): StorageAdapter {
  return {
    get: (key) => db.getSetting(key),
    set: (key, value) => db.setSetting(key, value),
    remove: (key) => db.deleteSetting(key),
    keys: (prefix) => db.listSettingKeys(prefix),
  };
}
