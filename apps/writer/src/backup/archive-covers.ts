// Cover media inside archives: `covers/<basename>` entries for every `cover` / `cover_thumb`
// media asset. Packing reads each file through `CoverMedia` (platform file access, injected;
// web has none because its covers are inline data URIs). Restoring writes the files into this
// device's covers folder and rewrites `media_assets.relativePath` to the new location.
import type { MediaAssetRecord } from '@kn/core';
import type { ZipFiles } from '../export/zip.ts';
import { resolveMediaUri, toRelativePath } from '../store/covers.ts';
import { fail, LIMITS } from './archive-format.ts';

export const COVER_ENTRY_PREFIX = 'covers/';
export const MAX_COVER_BYTES = LIMITS.coverBytes;
export const MAX_COVER_FILES = LIMITS.coverFiles;

/** Platform file access for cover images. */
export interface CoverMedia {
  /** Bytes of a cover file, or null when it is missing / unreadable. */
  read(uri: string): Promise<Uint8Array | null>;
  /** Writes `name` into this device's covers folder and returns its local URI. */
  write(name: string, bytes: Uint8Array): Promise<string>;
}

type MediaRoot = { mediaRoot: string };
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9.-]{0,127}\.(jpe?g|png|webp)$/i;

/** Alphanumeric / dash / dot basenames with an image extension and no `..`. */
export const isSafeCoverName = (name: string): boolean =>
  SAFE_NAME.test(name) && !name.includes('..');

const isCover = (a: MediaAssetRecord): boolean => a.kind === 'cover' || a.kind === 'cover_thumb';

/** The safe basename of a stored cover path (relative or `file:`), null for data / http / odd ones. */
export function coverBasename(path: string): string | null {
  if (/^(data|https?|content):/i.test(path)) return null;
  const clean = path.split(/[?#]/)[0] ?? '';
  const name = clean.slice(clean.lastIndexOf('/') + 1);
  return isSafeCoverName(name) ? name : null;
}

/** Reads every cover / thumbnail file the assets point at. Missing files are skipped. */
export async function collectCovers(
  repo: MediaRoot,
  assets: readonly MediaAssetRecord[],
  media: CoverMedia,
): Promise<ZipFiles> {
  const out: ZipFiles = {};
  for (const a of assets) {
    const name = isCover(a) ? coverBasename(a.relativePath) : null;
    if (!name || out[`${COVER_ENTRY_PREFIX}${name}`]) continue;
    const bytes = await media.read(resolveMediaUri(repo, a.relativePath));
    if (bytes && bytes.length > 0 && bytes.length <= MAX_COVER_BYTES)
      out[`${COVER_ENTRY_PREFIX}${name}`] = bytes;
  }
  return out;
}

/** Validates one `covers/*` zip entry and returns its basename. Throws a readable error. */
export function validateCoverEntry(entryName: string, data: Uint8Array): string {
  const name = entryName.slice(COVER_ENTRY_PREFIX.length);
  if (!isSafeCoverName(name)) return fail(`Unsafe cover file name "${entryName}".`);
  if (data.length > MAX_COVER_BYTES) return fail(`Cover "${name}" is too large.`);
  return name;
}

/**
 * Writes the archive's cover files and returns the assets pointed at their new local paths.
 * Assets whose file is absent keep their old path (Document Doctor reports them).
 */
export async function restoreCovers(
  repo: MediaRoot,
  covers: Readonly<Record<string, Uint8Array>>,
  assets: readonly MediaAssetRecord[],
  media: CoverMedia | undefined,
): Promise<MediaAssetRecord[]> {
  if (!media) return [...assets];
  const written = new Map<string, string>();
  for (const [name, bytes] of Object.entries(covers))
    written.set(name, await media.write(name, bytes));
  return assets.map((a) => {
    const name = isCover(a) ? coverBasename(a.relativePath) : null;
    const uri = name ? written.get(name) : undefined;
    return uri ? { ...a, relativePath: toRelativePath(repo, uri) } : a;
  });
}
