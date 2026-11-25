// ZIP helpers over fflate: sync for small payloads, streaming async above 50 KB so large books
// and workspace backups never block the UI thread in one go. Pure (no platform imports).
import { strFromU8, strToU8, unzip, unzipSync, Zip, ZipDeflate, zipSync } from 'fflate';
import { writeZip } from './zip-write.ts';

export const ZIP_SYNC_LIMIT = 50 * 1024;

export type ZipFiles = Record<string, Uint8Array>;

/** An entry with options. `store: true` writes compression method 0 (STORE) with exact
 *  CRC/sizes and no extra field — what EPUB's OCF needs for `mimetype` at offset 0. */
export interface ZipEntry {
  data: Uint8Array;
  store?: boolean;
}

/** Plain bytes (DEFLATE, the default) or an entry with options. */
export type ZipInput = Record<string, Uint8Array | ZipEntry>;

const isEntry = (v: Uint8Array | ZipEntry): v is ZipEntry => !(v instanceof Uint8Array);

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

/** Zips `files` in insertion order (so `[Content_Types].xml` / `manifest.json` stay first).
 *  Archives with any `store` entry use the explicit-header writer (zip-write.ts); all others
 *  keep the fflate path unchanged. */
export function zipFiles(input: ZipInput): Promise<Uint8Array> {
  const named = Object.entries(input);
  if (named.some(([, v]) => isEntry(v) && v.store)) {
    return writeZip(
      named.map(([name, v]) =>
        isEntry(v)
          ? { name, data: v.data, store: v.store === true }
          : { name, data: v, store: false },
      ),
    );
  }
  const files: ZipFiles = Object.fromEntries(
    named.map(([name, v]) => [name, isEntry(v) ? v.data : v]),
  );
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
