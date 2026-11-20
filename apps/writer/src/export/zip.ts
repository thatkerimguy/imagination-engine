// ZIP helpers over fflate: sync for small payloads, streaming async above 50 KB so large books
// and workspace backups never block the UI thread in one go. Pure (no platform imports).
import { strFromU8, strToU8, unzip, unzipSync, Zip, ZipDeflate, zipSync } from 'fflate';

export const ZIP_SYNC_LIMIT = 50 * 1024;

export type ZipFiles = Record<string, Uint8Array>;

export const totalBytes = (files: ZipFiles): number =>
  Object.values(files).reduce((n, f) => n + f.length, 0);

/** True when `zipFiles` would take the async streaming path. */
export const usesAsyncZip = (files: ZipFiles): boolean => totalBytes(files) > ZIP_SYNC_LIMIT;

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** Zips `files` in insertion order (so `[Content_Types].xml` / `manifest.json` stay first). */
export function zipFiles(files: ZipFiles): Promise<Uint8Array> {
  if (!usesAsyncZip(files)) return Promise.resolve(zipSync(files, { level: 6 }));
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const zip = new Zip((err, chunk, final) => {
      if (err) return reject(err);
      chunks.push(chunk);
      if (final) resolve(concat(chunks));
    });
    try {
      for (const [name, data] of Object.entries(files)) {
        const entry = new ZipDeflate(name, { level: 6 });
        zip.add(entry);
        entry.push(data, true);
      }
      zip.end();
    } catch (err) {
      reject(err);
    }
  });
}

/** Unzips; rejects on a corrupt archive. Async `unzip` above 50 KB. */
export function unzipFiles(bytes: Uint8Array): Promise<ZipFiles> {
  if (bytes.length <= ZIP_SYNC_LIMIT) {
    try {
      return Promise.resolve(unzipSync(bytes));
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error('Not a valid ZIP archive'));
    }
  }
  return new Promise((resolve, reject) => {
    unzip(bytes, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

export const textOf = (bytes: Uint8Array): string => strFromU8(bytes);
export const bytesOf = (text: string): Uint8Array => strToU8(text);
