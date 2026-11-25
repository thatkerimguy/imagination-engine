// Backup archives (ZIP via fflate): `.knbook` (one novel), `.knchap` (one chapter) and a
// full-workspace `.zip`. Every archive holds `manifest.json` plus one `kv/<key>` entry per
// stored key (the raw stored JSON). Restores validate EVERYTHING first — manifests, chapters,
// JSON — and only then write, so a bad archive never leaves half-restored data.
// Pure: works on a StorageAdapter, no platform imports.
import { SCHEMA_VERSION } from '@kn/core';
import { bytesOf, textOf, unzipFiles, zipFiles, type ZipFiles } from '../export/zip.ts';
import type { StorageAdapter } from '../storage/types.ts';
import { fail, readManifest, validateEntry } from './archive-validate.ts';

export const ARCHIVE_VERSION = 1;
export const ARCHIVE_APP = 'kinetic-novel-writer';
export type ArchiveKind = 'knbook' | 'knchap' | 'workspace';

export interface ArchiveManifest {
  app: typeof ARCHIVE_APP;
  kind: ArchiveKind;
  version: number;
  schemaVersion: number;
  createdAt: number;
  title?: string;
  keyCount: number;
}

export const WORKSPACE_PREFIXES = [
  'novel/',
  'season/',
  'chapter/',
  'folder/',
  'doc/',
  'meta/',
  'versions/',
  'growth/',
  'setting/',
  'trash/',
] as const;

/** Lock secrets and the publish token never leave the device and are never overwritten by a restore. */
export const isSecretKey = (key: string): boolean =>
  key.startsWith('setting/lock') || key === 'setting/publish-secret';

export const allowedKey = (key: string): boolean =>
  WORKSPACE_PREFIXES.some((p) => key.startsWith(p)) && !isSecretKey(key);

const entryName = (key: string): string => `kv/${key.split('/').map(encodeURIComponent).join('/')}`;
const keyOfEntry = (name: string): string =>
  name.slice(3).split('/').map(decodeURIComponent).join('/');

export interface KvEntry {
  key: string;
  value: string;
}

export async function readKeys(
  adapter: StorageAdapter,
  keys: readonly string[],
): Promise<KvEntry[]> {
  const out: KvEntry[] = [];
  for (const key of keys) {
    const value = await adapter.get(key);
    if (value !== null && allowedKey(key)) out.push({ key, value });
  }
  return out;
}

async function pack(
  kind: ArchiveKind,
  entries: readonly KvEntry[],
  title?: string,
  now = Date.now(),
): Promise<Uint8Array> {
  const manifest: ArchiveManifest = {
    app: ARCHIVE_APP,
    kind,
    version: ARCHIVE_VERSION,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    ...(title ? { title } : {}),
    keyCount: entries.length,
  };
  const files: ZipFiles = { 'manifest.json': bytesOf(JSON.stringify(manifest, null, 2)) };
  for (const e of entries) files[entryName(e.key)] = bytesOf(e.value);
  return zipFiles(files);
}

// ── Packing ───────────────────────────────────────────────────────────────────────────────

export async function packWorkspace(
  adapter: StorageAdapter,
  now = Date.now(),
): Promise<Uint8Array> {
  const keys: string[] = [];
  for (const prefix of WORKSPACE_PREFIXES) keys.push(...(await adapter.keys(prefix)));
  return pack('workspace', await readKeys(adapter, keys), undefined, now);
}

const lastSegment = (key: string): string => key.slice(key.lastIndexOf('/') + 1);

/** The sidecar keys that belong to one chapter or note id. */
const sidecars = (id: string): string[] => [`meta/chapter-styles/${id}`, `meta/item/${id}`];

export async function packNovel(
  adapter: StorageAdapter,
  novelId: string,
  now = Date.now(),
): Promise<Uint8Array> {
  const novel = await adapter.get(`novel/${novelId}`);
  if (novel === null) throw new Error('That book was not found.');
  const chapterKeys = await adapter.keys(`chapter/${novelId}/`);
  const keys = [
    `novel/${novelId}`,
    ...(await adapter.keys(`season/${novelId}/`)),
    ...chapterKeys,
    ...chapterKeys.flatMap((k) => sidecars(lastSegment(k))),
    `meta/item/${novelId}`,
  ];
  const title = (JSON.parse(novel) as { data?: { title?: string } }).data?.title;
  return pack('knbook', await readKeys(adapter, keys), title, now);
}

export async function packChapter(
  adapter: StorageAdapter,
  novelId: string,
  seasonId: string,
  chapterId: string,
  now = Date.now(),
): Promise<Uint8Array> {
  const key = `chapter/${novelId}/${seasonId}/${chapterId}`;
  const entries = await readKeys(adapter, [key, ...sidecars(chapterId)]);
  if (!entries.some((e) => e.key === key)) throw new Error('That chapter was not found.');
  return pack('knchap', entries, undefined, now);
}

// ── Reading + validation ──────────────────────────────────────────────────────────────────

export interface ParsedArchive {
  manifest: ArchiveManifest;
  entries: KvEntry[];
}

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
  const manifest = readManifest(files['manifest.json']);
  if (expect && manifest.kind !== expect)
    fail(`Expected a ${expect} file but this is a ${manifest.kind} backup.`);
  const entries: KvEntry[] = [];
  for (const [name, data] of Object.entries(files)) {
    if (name === 'manifest.json' || name.endsWith('/')) continue;
    if (!name.startsWith('kv/')) fail(`Unexpected entry "${name}" in the backup.`);
    const key = keyOfEntry(name);
    const value = textOf(data);
    validateEntry(key, value);
    entries.push({ key, value });
  }
  return { manifest, entries };
}

// ── Restoring ─────────────────────────────────────────────────────────────────────────────

export interface RestoreSummary {
  kind: ArchiveKind;
  keys: number;
  title?: string;
}

/** Replaces every workspace key (except lock secrets) with the archive's contents. */
export async function restoreWorkspace(
  adapter: StorageAdapter,
  bytes: Uint8Array,
): Promise<RestoreSummary> {
  const { entries } = await parseArchive(bytes, 'workspace');
  const incoming = new Set(entries.map((e) => e.key));
  for (const prefix of WORKSPACE_PREFIXES)
    for (const key of await adapter.keys(prefix))
      if (!isSecretKey(key) && !incoming.has(key)) await adapter.remove(key);
  for (const e of entries) await adapter.set(e.key, e.value);
  return { kind: 'workspace', keys: entries.length };
}

/** Adds (or overwrites in place) one book from a `.knbook`. */
export async function restoreNovel(
  adapter: StorageAdapter,
  bytes: Uint8Array,
): Promise<RestoreSummary> {
  const { manifest, entries } = await parseArchive(bytes, 'knbook');
  const novels = entries.filter((e) => /^novel\/[^/]+$/.test(e.key));
  if (novels.length !== 1) fail('A .knbook must contain exactly one book.');
  for (const e of entries) await adapter.set(e.key, e.value);
  return {
    kind: 'knbook',
    keys: entries.length,
    ...(manifest.title ? { title: manifest.title } : {}),
  };
}
