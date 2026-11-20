// Automatic emergency snapshots (native) and the manual "Back up now" export.
import { fileStem } from '../export/book-model.ts';
import { deliverFile } from '../export/deliver.ts';
import type { NovelRepository } from '../store/repository.ts';
import { exportWorkspaceArchive } from './archive-repo.ts';
import { isBackupDue, loadBackupSettings, saveBackupSettings } from './backup-settings.ts';
import { writeSnapshot } from './snapshots.ts';

export * from './backup-settings.ts';

/** Writes a rotating snapshot when one is due. Never throws; returns true when one was written. */
export async function maybeAutoBackup(repo: NovelRepository, now = Date.now()): Promise<boolean> {
  try {
    if (!isBackupDue(await loadBackupSettings(repo), now)) return false;
    const written = await writeSnapshot(await exportWorkspaceArchive(repo), now);
    if (written) await saveBackupSettings(repo, { lastBackupAt: now });
    return written;
  } catch (err) {
    console.warn('[writer] auto-backup failed', err);
    return false;
  }
}

/** Packs the whole workspace and hands it to the share sheet / browser download. */
export async function manualBackup(repo: NovelRepository, now = Date.now()): Promise<void> {
  const bytes = await exportWorkspaceArchive(repo);
  const day = new Date(now).toISOString().slice(0, 10);
  await deliverFile(`${fileStem('kinetic-writer-backup')}-${day}.zip`, bytes, 'application/zip');
  await saveBackupSettings(repo, { lastBackupAt: now });
}
