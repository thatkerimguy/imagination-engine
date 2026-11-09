/** File storage with `/`-separated relative paths, e.g. `audio/night-drive.ogg`. */
export interface FileStore {
  read(path: string): Promise<Blob | undefined>;
  write(path: string, data: Blob | string): Promise<void>;
  delete(path: string): Promise<void>;
  /** Names of the files directly inside `dir` (not recursive). */
  list(dir?: string): Promise<string[]>;
}

export function splitPath(path: string): string[] {
  const parts = path.split('/').filter((part) => part.length > 0);
  if (parts.length === 0) throw new Error('A file path must not be empty.');
  for (const part of parts) {
    if (part === '.' || part === '..') throw new Error(`Path "${path}" must not contain . or ..`);
  }
  return parts;
}

function dirOf(path: string): string {
  const parts = splitPath(path);
  return parts.slice(0, -1).join('/');
}

export function createMemoryFileStore(): FileStore {
  const files = new Map<string, Blob>();
  const key = (path: string) => splitPath(path).join('/');
  return {
    read: (path) => Promise.resolve(files.get(key(path))),
    write: (path, data) => {
      files.set(key(path), typeof data === 'string' ? new Blob([data]) : data);
      return Promise.resolve();
    },
    delete: (path) => {
      files.delete(key(path));
      return Promise.resolve();
    },
    list: (dir = '') => {
      const normalized = dir ? splitPath(dir).join('/') : '';
      const names = [...files.keys()]
        .filter((p) => dirOf(p) === normalized)
        .map((p) => p.split('/').at(-1) ?? p);
      return Promise.resolve(names.sort());
    },
  };
}

export function isOpfsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';
}

/** Origin Private File System store. Works in Chrome on Android and desktop. */
export async function openOpfsFileStore(rootDir = 'imagination'): Promise<FileStore> {
  if (!isOpfsSupported()) throw new Error('This browser has no Origin Private File System.');
  const origin = await navigator.storage.getDirectory();
  const root = await origin.getDirectoryHandle(rootDir, { create: true });

  const dirHandle = async (parts: string[], create: boolean) => {
    let handle = root;
    for (const part of parts) handle = await handle.getDirectoryHandle(part, { create });
    return handle;
  };

  const isNotFound = (error: unknown) =>
    error instanceof DOMException &&
    (error.name === 'NotFoundError' || error.name === 'TypeMismatchError');

  return {
    async read(path) {
      const parts = splitPath(path);
      try {
        const dir = await dirHandle(parts.slice(0, -1), false);
        const file = await dir.getFileHandle(parts.at(-1) ?? '');
        return await file.getFile();
      } catch (error) {
        if (isNotFound(error)) return undefined;
        throw error;
      }
    },
    async write(path, data) {
      const parts = splitPath(path);
      const dir = await dirHandle(parts.slice(0, -1), true);
      const file = await dir.getFileHandle(parts.at(-1) ?? '', { create: true });
      const writable = await file.createWritable();
      await writable.write(data);
      await writable.close();
    },
    async delete(path) {
      const parts = splitPath(path);
      try {
        const dir = await dirHandle(parts.slice(0, -1), false);
        await dir.removeEntry(parts.at(-1) ?? '');
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    },
    async list(dir = '') {
      try {
        const handle = await dirHandle(dir ? splitPath(dir) : [], false);
        const names: string[] = [];
        for await (const [name, entry] of handle.entries()) {
          if (entry.kind === 'file') names.push(name);
        }
        return names.sort();
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
    },
  };
}
