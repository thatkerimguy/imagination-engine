// Backup archive format v2 (ZIP via fflate). Every archive holds `manifest.json` plus relational
// JSON tables (`tables/<name>.json`, plain row arrays straight from `DatabasePort.exportTables`);
// workspace backups and books also carry `covers/<file>` images. Archives made by the v1
// key-value app are rejected. Pure: no platform imports.
import type { DatabaseTables } from '../db/port.ts';
import { textOf } from '../export/zip.ts';

export const ARCHIVE_FORMAT_VERSION = 2;
export const ARCHIVE_APP = 'kinetic-novel-writer';
export type ArchiveKind = 'knbook' | 'knchap' | 'workspace';

export interface ArchiveManifest {
  app: typeof ARCHIVE_APP;
  kind: ArchiveKind;
  formatVersion: number;
  createdAt: number;
  title?: string;
  /** Rows per table (+ `covers`), for the restore confirm dialog and sanity checks. */
  counts: Record<string, number>;
}

export const TABLE_FILES: Record<keyof DatabaseTables, string> = {
  nodes: 'tables/nodes.json',
  nodeBodies: 'tables/node_bodies.json',
  nodeLinks: 'tables/node_links.json',
  growthLogs: 'tables/growth_logs.json',
  mediaAssets: 'tables/media_assets.json',
  settings: 'tables/settings.json',
  gimmickPacks: 'tables/gimmick_packs.json',
  gimmickBlueprints: 'tables/gimmick_blueprints.json',
};

export const LIMITS = {
  entries: 1_000,
  tableBytes: 96 * 1024 * 1024,
  totalBytes: 384 * 1024 * 1024,
  coverBytes: 8 * 1024 * 1024,
  coverFiles: 400,
} as const;

/** Lock secrets and the publish token never leave the device and are never overwritten by a restore. */
export const isSecretKey = (key: string): boolean =>
  key.startsWith('setting/lock') || key === 'setting/publish-secret';

/** Doctor quarantine copies stay on the device. */
export const isQuarantineKey = (key: string): boolean => key.startsWith('quarantine/');

export function fail(message: string): never {
  throw new Error(message);
}

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function readManifest(raw: Uint8Array | undefined): ArchiveManifest {
  if (!raw) return fail('This is not a Kinetic Novel backup (manifest.json is missing).');
  let m: unknown;
  try {
    m = JSON.parse(textOf(raw));
  } catch {
    return fail('The backup manifest is corrupted.');
  }
  if (!isObject(m) || m.app !== ARCHIVE_APP) return fail('This is not a Kinetic Novel backup.');
  if (m.kind !== 'knbook' && m.kind !== 'knchap' && m.kind !== 'workspace')
    return fail('Unknown backup type.');
  if (typeof m.formatVersion !== 'number' && typeof m.version === 'number')
    return fail('Unsupported backup version: this file was made by an older version of the app.');
  if (typeof m.formatVersion !== 'number' || m.formatVersion < ARCHIVE_FORMAT_VERSION)
    return fail('Unsupported backup version.');
  if (m.formatVersion > ARCHIVE_FORMAT_VERSION)
    return fail('This backup was made by a newer version of the app.');
  const counts = isObject(m.counts) ? m.counts : {};
  return {
    app: ARCHIVE_APP,
    kind: m.kind,
    formatVersion: m.formatVersion,
    createdAt: typeof m.createdAt === 'number' ? m.createdAt : 0,
    ...(typeof m.title === 'string' ? { title: m.title } : {}),
    counts: Object.fromEntries(
      Object.entries(counts).filter((e): e is [string, number] => typeof e[1] === 'number'),
    ),
  };
}
