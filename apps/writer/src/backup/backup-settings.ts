// Auto-backup preferences (`setting/backup`). Pure.
import { keys } from '../store/documents.ts';
import type { NovelRepository } from '../store/repository.ts';

export type BackupInterval = 0 | 6 | 24 | 168;
export const BACKUP_INTERVALS: readonly BackupInterval[] = [0, 6, 24, 168];

export interface BackupSettings {
  /** Hours between automatic emergency snapshots; 0 = off. */
  intervalHours: BackupInterval;
  lastBackupAt: number | null;
}

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = { intervalHours: 24, lastBackupAt: null };

export async function loadBackupSettings(repo: NovelRepository): Promise<BackupSettings> {
  const s = (await repo.docs.read<Partial<BackupSettings>>(keys.setting('backup')))?.data;
  const hours = BACKUP_INTERVALS.find((h) => h === s?.intervalHours);
  return {
    intervalHours: hours ?? DEFAULT_BACKUP_SETTINGS.intervalHours,
    lastBackupAt: typeof s?.lastBackupAt === 'number' ? s.lastBackupAt : null,
  };
}

export async function saveBackupSettings(
  repo: NovelRepository,
  patch: Partial<BackupSettings>,
): Promise<BackupSettings> {
  const next = { ...(await loadBackupSettings(repo)), ...patch };
  await repo.docs.write(keys.setting('backup'), next);
  return next;
}

/** True when an automatic snapshot is due. */
export const isBackupDue = (s: BackupSettings, now: number): boolean =>
  s.intervalHours > 0 &&
  (s.lastBackupAt === null || now - s.lastBackupAt >= s.intervalHours * 3_600_000);
