// Auto-backup preferences (`setting/backup`), including the optional external (SAF) folder the
// snapshots are mirrored to. Pure.
import { keys } from '../store/documents.ts';
import type { NovelRepository } from '../store/repository.ts';

export type BackupInterval = 0 | 6 | 24 | 168;
export const BACKUP_INTERVALS: readonly BackupInterval[] = [0, 6, 24, 168];

export interface BackupSettings {
  /** Hours between automatic emergency snapshots; 0 = off. */
  intervalHours: BackupInterval;
  lastBackupAt: number | null;
  /** Android SAF tree URI of the external backup folder (persisted permission). */
  safFolderUri?: string;
  /** Human folder name for that URI, e.g. `Documents/ImaginationEngine`. */
  safFolderLabel?: string;
  /** ISO-8601 UTC time of the last successful mirror into the external folder. */
  lastSafMirrorAt?: string;
  /** Why the last mirror failed (folder revoked / unmounted); cleared on the next success. */
  lastSafMirrorError?: string;
}

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = { intervalHours: 24, lastBackupAt: null };

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export async function loadBackupSettings(repo: NovelRepository): Promise<BackupSettings> {
  const s = (
    await repo.docs.read<Partial<Record<keyof BackupSettings, unknown>>>(keys.setting('backup'))
  )?.data;
  const hours = BACKUP_INTERVALS.find((h) => h === s?.intervalHours);
  const out: BackupSettings = {
    intervalHours: hours ?? DEFAULT_BACKUP_SETTINGS.intervalHours,
    lastBackupAt: typeof s?.lastBackupAt === 'number' ? s.lastBackupAt : null,
  };
  const uri = str(s?.safFolderUri);
  if (uri) {
    out.safFolderUri = uri;
    out.safFolderLabel = str(s?.safFolderLabel) ?? 'External folder';
    const at = str(s?.lastSafMirrorAt);
    if (at) out.lastSafMirrorAt = at;
    const err = str(s?.lastSafMirrorError);
    if (err) out.lastSafMirrorError = err;
  }
  return out;
}

/** Merges `patch` (an `undefined` value clears that field) and saves. */
export async function saveBackupSettings(
  repo: NovelRepository,
  patch: { [K in keyof BackupSettings]?: BackupSettings[K] | undefined },
): Promise<BackupSettings> {
  const merged: Record<string, unknown> = { ...(await loadBackupSettings(repo)), ...patch };
  const next = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined));
  await repo.docs.write(keys.setting('backup'), next);
  return loadBackupSettings(repo);
}

/** True when an automatic snapshot is due. */
export const isBackupDue = (s: BackupSettings, now: number): boolean =>
  s.intervalHours > 0 &&
  (s.lastBackupAt === null || now - s.lastBackupAt >= s.intervalHours * 3_600_000);
