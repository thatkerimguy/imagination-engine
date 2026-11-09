import { isOpfsSupported } from './files.ts';
import { isIndexedDbSupported } from './kv.ts';

export interface StorageStatus {
  readonly persisted: boolean;
  readonly usage?: number;
  readonly quota?: number;
  readonly opfs: boolean;
  readonly indexedDb: boolean;
}

/**
 * Asks the browser not to evict our data under storage pressure. Chrome grants this silently for
 * installed or frequently used sites; it never shows a prompt.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const base = { opfs: isOpfsSupported(), indexedDb: isIndexedDbSupported() };
  if (typeof navigator === 'undefined' || !navigator.storage) return { ...base, persisted: false };
  try {
    const [persisted, estimate] = await Promise.all([
      navigator.storage.persisted(),
      navigator.storage.estimate(),
    ]);
    return {
      ...base,
      persisted,
      ...(estimate.usage !== undefined ? { usage: estimate.usage } : {}),
      ...(estimate.quota !== undefined ? { quota: estimate.quota } : {}),
    };
  } catch {
    return { ...base, persisted: false };
  }
}
