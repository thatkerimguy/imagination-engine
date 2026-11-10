import {
  createMemoryFileStore,
  isOpfsSupported,
  openOpfsFileStore,
  type FileStore,
} from '@ie/core';

let files: Promise<FileStore> | null = null;

/** Imported audio lives in OPFS beside the project database; in memory if OPFS is missing. */
export function audioFiles(): Promise<FileStore> {
  files ??= (async () => {
    if (!isOpfsSupported()) return createMemoryFileStore();
    try {
      return await openOpfsFileStore('imagination-studio');
    } catch (error) {
      console.warn('OPFS is unavailable; imported audio will not be kept.', error);
      return createMemoryFileStore();
    }
  })();
  return files;
}
