// Cover media inside workspace `.zip` backups: `covers/<basename>` entries next to `kv/*`.
// Packing reads every `file:` cover referenced by `meta/item/*` (plus its `.thumb.jpg`);
// restoring validates names strictly (no traversal, image extensions only, size cap), writes
// the files into this device's covers folder and rewrites `meta/item/*` to the new local URIs.
// Pure: the platform file access is injected (media/cover-archive.ts; web is a no-op).
import { thumbUriForCover } from '../media/cover-resize.ts';
import type { ZipFiles } from '../export/zip.ts';
import type { StorageAdapter } from '../storage/types.ts';

export const COVER_ENTRY_PREFIX = 'covers/';
export const MAX_COVER_BYTES = 8 * 1024 * 1024;
export const MAX_COVER_FILES = 400;

/** Platform file access for cover images. */
export interface CoverMedia {
  /** Bytes of a cover file, or null when it is missing / unreadable. */
  read(uri: string): Promise<Uint8Array | null>;
  /** Writes `name` into this device's covers folder and returns its local URI. */
  write(name: string, bytes: Uint8Array): Promise<string>;
}

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9.-]{0,127}\.(jpe?g|png|webp)$/i;

/** Alphanumeric / dash / dot basenames with an image extension and no `..`. */
export const isSafeCoverName = (name: string): boolean =>
  SAFE_NAME.test(name) && !name.includes('..');

/** The basename of a local `file:` cover URI, or null for data / http / unsafe URIs. */
export function coverBasename(uri: string): string | null {
  if (!/^file:/i.test(uri)) return null;
  const clean = uri.split(/[?#]/)[0] ?? '';
  const name = clean.slice(clean.lastIndexOf('/') + 1);
  return isSafeCoverName(name) ? name : null;
}

const coverUriOf = (raw: string): string | null => {
  try {
    const v = (JSON.parse(raw) as { data?: { coverUri?: unknown } }).data?.coverUri;
    return typeof v === 'string' && v ? v : null;
  } catch {
    return null;
  }
};

/** Reads every referenced cover (and thumbnail) into zip entries. Missing files are skipped. */
export async function collectCovers(
  entries: readonly { key: string; value: string }[],
  media: CoverMedia,
): Promise<ZipFiles> {
  const out: ZipFiles = {};
  for (const e of entries) {
    if (!e.key.startsWith('meta/item/')) continue;
    const uri = coverUriOf(e.value);
    if (!uri || !coverBasename(uri)) continue;
    for (const u of [uri, thumbUriForCover(uri)]) {
      const name = coverBasename(u);
      if (!name || out[`${COVER_ENTRY_PREFIX}${name}`]) continue;
      const bytes = await media.read(u);
      if (bytes && bytes.length > 0 && bytes.length <= MAX_COVER_BYTES)
        out[`${COVER_ENTRY_PREFIX}${name}`] = bytes;
    }
  }
  return out;
}

/** Validates one `covers/*` zip entry and returns its basename. Throws a readable error. */
export function validateCoverEntry(entryName: string, data: Uint8Array): string {
  const name = entryName.slice(COVER_ENTRY_PREFIX.length);
  if (!isSafeCoverName(name)) throw new Error(`Unsafe cover file name "${entryName}".`);
  if (data.length > MAX_COVER_BYTES) throw new Error(`Cover "${name}" is too large.`);
  return name;
}

/**
 * Writes restored cover files and points `meta/item/*` at them. Covers whose file is absent
 * from the archive keep their old URI (Document Doctor reports them). Returns files written.
 */
export async function restoreCovers(
  adapter: StorageAdapter,
  covers: Readonly<Record<string, Uint8Array>>,
  media: CoverMedia,
): Promise<number> {
  const written = new Map<string, string>();
  for (const [name, bytes] of Object.entries(covers))
    written.set(name, await media.write(name, bytes));
  if (written.size === 0) return 0;
  for (const key of await adapter.keys('meta/item/')) {
    const raw = await adapter.get(key);
    if (raw === null) continue;
    const uri = coverUriOf(raw);
    const name = uri ? coverBasename(uri) : null;
    const next = name ? written.get(name) : undefined;
    if (!next || next === uri) continue;
    const stored = JSON.parse(raw) as { data: Record<string, unknown> };
    await adapter.set(key, JSON.stringify({ ...stored, data: { ...stored.data, coverUri: next } }));
  }
  return written.size;
}
