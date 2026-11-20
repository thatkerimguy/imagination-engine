// Archive validation: every manifest, chapter and JSON entry is checked before anything is written.
import {
  parseNovelManifest,
  parseSeasonManifest,
  type ChapterDocument,
  type ParseResult,
} from '@kn/core';
import { textOf } from '../export/zip.ts';
import { prepareChapter } from '../store/sanitize.ts';
import { ARCHIVE_APP, ARCHIVE_VERSION, allowedKey, type ArchiveManifest } from './archive.ts';

export function fail(message: string): never {
  throw new Error(message);
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function must<T>(what: string, result: ParseResult<T>): T {
  return result.ok ? result.value : fail(`${what}: ${result.errors.join('; ')}`);
}

export function validateEntry(key: string, value: string): void {
  let stored: unknown;
  try {
    stored = JSON.parse(value);
  } catch {
    return fail(`"${key}" is corrupted (not valid JSON).`);
  }
  if (!allowedKey(key)) return fail(`"${key}" is not a key this app can restore.`);
  const data = isObject(stored) ? stored.data : undefined;
  if (key.startsWith('novel/')) must(`Novel "${key}"`, parseNovelManifest(data));
  else if (key.startsWith('season/')) must(`Season "${key}"`, parseSeasonManifest(data));
  else if (key.startsWith('chapter/')) {
    if (!isObject(data)) return fail(`Chapter "${key}" is empty or malformed.`);
    const p = prepareChapter(data as unknown as ChapterDocument);
    if (!p.ok) fail(`Chapter "${key}": ${p.errors.join('; ')}`);
  }
}

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
  if (typeof m.version !== 'number' || m.version > ARCHIVE_VERSION)
    return fail('This backup was made by a newer version of the app.');
  return m as unknown as ArchiveManifest;
}
