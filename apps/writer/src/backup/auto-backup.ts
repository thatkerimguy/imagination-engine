// Automatic emergency snapshots (native) and the manual "Back up now" export.
import { fileStem } from '../export/book-model.ts';
import { deliverBytes, type DeliverResult } from '../export/deliver';
import type { NovelRepository } from '../store/repository.ts';
import { exportWorkspaceArchive } from './archive-repo.ts';
import { isBackupDue, loadBackupSettings, saveBackupSettings } from './backup-settings.ts';
import { writeSnapshot } from './snapshots';

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

/** Packs the whole workspace and saves it via the file picker / browser download. Only runs on
 *  an explicit tap ("Back up now"); the scheduled backup above writes local snapshots only. */
export async function manualBackup(
  repo: NovelRepository,
  now = Date.now(),
): Promise<DeliverResult> {
  const bytes = await exportWorkspaceArchive(repo);
  const day = new Date(now).toISOString().slice(0, 10);
  const name = `${fileStem('kinetic-writer-backup')}-${day}.zip`;
  const result = await deliverBytes(name, bytes, 'application/zip');
  if (result === 'saved') await saveBackupSettings(repo, { lastBackupAt: now });
  return result;
}
