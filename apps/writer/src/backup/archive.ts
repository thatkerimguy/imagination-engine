// Backup archives: packing + strict reading, and the full-workspace `.zip` restore. Format in
// archive-format.ts; books in archive-book.ts, chapters in archive-chapter.ts. Restores validate
// EVERYTHING first, then replace the database in one atomic `replaceAll`, so a bad archive
// never leaves half-restored data. Pure: works on a NovelRepository, no platform imports.
import type { DatabaseTables } from '../db/port.ts';
import { bytesOf, textOf, unzipFiles, zipFiles, type ZipFiles } from '../export/zip.ts';
import type { NovelRepository } from '../store/repository.ts';
import {
  collectCovers,
  COVER_ENTRY_PREFIX,
  MAX_COVER_FILES,
  restoreCovers,
  validateCoverEntry,
  type CoverMedia,
} from './archive-covers.ts';
import {
  ARCHIVE_APP,
  ARCHIVE_FORMAT_VERSION,
  fail,
  isQuarantineKey,
  isSecretKey,
  LIMITS,
  readManifest,
  TABLE_FILES,
  type ArchiveKind,
  type ArchiveManifest,
} from './archive-format.ts';
import { validateTables } from './archive-validate.ts';

export * from './archive-format.ts';

const TABLE_KEYS = Object.keys(TABLE_FILES) as (keyof DatabaseTables)[];
const BY_FILE = new Map(TABLE_KEYS.map((k) => [TABLE_FILES[k], k]));
const rowTotal = (t: DatabaseTables): number => TABLE_KEYS.reduce((sum, k) => sum + t[k].length, 0);

/** Zips tables (+ cover files) behind a v2 manifest. */
export async function buildArchive(
  kind: ArchiveKind,
  tables: DatabaseTables,
  covers: ZipFiles,
  now: number,
  title?: string,
): Promise<Uint8Array> {
  const counts: Record<string, number> = { covers: Object.keys(covers).length };
  const files: ZipFiles = {};
  for (const k of TABLE_KEYS) {
    counts[k] = tables[k].length;
    files[TABLE_FILES[k]] = bytesOf(JSON.stringify(tables[k]));
  }
  const manifest: ArchiveManifest = {
    app: ARCHIVE_APP,
    kind,
    formatVersion: ARCHIVE_FORMAT_VERSION,
    createdAt: now,
    ...(title ? { title } : {}),
    counts,
  };
  return zipFiles({
    'manifest.json': bytesOf(JSON.stringify(manifest, null, 2)),
    ...files,
    ...covers,
  });
}

export async function packWorkspace(
  repo: NovelRepository,
  now = Date.now(),
  media?: CoverMedia,
): Promise<Uint8Array> {
  const tables = await repo.db.exportTables();
  const settings = tables.settings.filter((s) => !isSecretKey(s.key) && !isQuarantineKey(s.key));
  const covers = media ? await collectCovers(repo, tables.mediaAssets, media) : {};
  return buildArchive('workspace', { ...tables, settings }, covers, now);
}

export interface ParsedArchive {
  manifest: ArchiveManifest;
  tables: DatabaseTables;
  /** Validated `covers/*` files by basename. */
  covers: Record<string, Uint8Array>;
}

const unsafeName = (name: string): boolean =>
  name.includes('\\') ||
  name.startsWith('/') ||
  name.split('/').some((s) => s === '..' || s === '');

/** Unzips and fully validates an archive. Throws a readable error; touches no storage. */
export async function parseArchive(
  bytes: Uint8Array,
  expect?: ArchiveKind,
): Promise<ParsedArchive> {
  let files: ZipFiles;
  try {
    files = await unzipFiles(bytes);
  } catch {
    return fail('The file is not a valid backup archive.');
  }
  const names = Object.keys(files);
  if (names.length > LIMITS.entries) fail('The backup has too many files.');
  if (names.reduce((sum, n) => sum + (files[n]?.length ?? 0), 0) > LIMITS.totalBytes)
    fail('The backup is too large.');
  const manifest = readManifest(files['manifest.json']);
  if (expect && manifest.kind !== expect)
    fail(`Expected a ${expect} file but this is a ${manifest.kind} backup.`);
  const raw: Partial<Record<keyof DatabaseTables, unknown>> = {};
  const covers: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) {
    if (name === 'manifest.json' || (name.endsWith('/') && data.length === 0)) continue;
    if (unsafeName(name)) fail(`Unsafe entry "${name}" in the backup.`);
    const table = BY_FILE.get(name);
    if (table) {
      if (data.length > LIMITS.tableBytes) fail(`Table "${name}" is too large.`);
      try {
        raw[table] = JSON.parse(textOf(data));
      } catch {
        fail(`"${name}" is corrupted (not valid JSON).`);
      }
    } else if (name.startsWith(COVER_ENTRY_PREFIX)) {
      covers[validateCoverEntry(name, data)] = data;
      if (Object.keys(covers).length > MAX_COVER_FILES) fail('The backup has too many covers.');
    } else fail(`Unexpected entry "${name}" in the backup.`);
  }
  if (raw.nodes === undefined) fail('The backup has no library (tables/nodes.json is missing).');
  return { manifest, tables: validateTables(raw), covers };
}

export interface RestoreSummary {
  kind: ArchiveKind;
  /** Rows restored across every table. */
  keys: number;
  title?: string;
}

/** Replaces the whole database with the archive; this device's lock / publish secrets survive. */
export async function restoreWorkspace(
  repo: NovelRepository,
  bytes: Uint8Array,
  media?: CoverMedia,
): Promise<RestoreSummary> {
  const { tables, covers } = await parseArchive(bytes, 'workspace');
  const secrets = (await repo.db.exportTables()).settings.filter((s) => isSecretKey(s.key));
  const mediaAssets = await restoreCovers(repo, covers, tables.mediaAssets, media);
  await repo.db.replaceAll({ ...tables, mediaAssets, settings: [...tables.settings, ...secrets] });
  repo.notifyChanged();
  return { kind: 'workspace', keys: rowTotal(tables) };
}
