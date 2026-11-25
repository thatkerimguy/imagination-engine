// Automatic emergency snapshots (native), the manual "Back up now", and mirroring both into the
// optional external backup folder (Android SAF) so a copy survives an uninstall.
import { fileStem } from '../export/book-model.ts';
import { deliverBytes, type DeliverResult } from '../export/deliver';
import type { NovelRepository } from '../store/repository.ts';
import { exportWorkspaceArchive } from './archive-repo.ts';
import { isBackupDue, loadBackupSettings, saveBackupSettings } from './backup-settings.ts';
import { mirrorToSaf } from './saf-mirror';
import { writeSnapshot } from './snapshots';

export * from './backup-settings.ts';

const reason = (err: unknown): string =>
  err instanceof Error && err.message ? err.message : 'The folder could not be written.';

/**
 * Copies an already-finalized archive into the external folder when one is connected. Never
 * throws: a revoked or unmounted folder is recorded as `lastSafMirrorError` (the local snapshot
 * is already safe). Returns true when mirrored.
 */
export async function mirrorExternal(
  repo: NovelRepository,
  bytes: Uint8Array,
  now: number,
): Promise<boolean> {
  const { safFolderUri } = await loadBackupSettings(repo);
  if (!safFolderUri) return false;
  try {
    if (!(await mirrorToSaf(safFolderUri, bytes, now))) return false;
    await saveBackupSettings(repo, {
      lastSafMirrorAt: new Date(now).toISOString(),
      lastSafMirrorError: undefined,
    });
    return true;
  } catch (err) {
    console.warn('[writer] external backup mirror failed', err);
    await saveBackupSettings(repo, { lastSafMirrorError: reason(err) });
    return false;
  }
}

/** Writes a rotating snapshot when one is due. Never throws; returns true when one was written. */
export async function maybeAutoBackup(repo: NovelRepository, now = Date.now()): Promise<boolean> {
  try {
    if (!isBackupDue(await loadBackupSettings(repo), now)) return false;
    const bytes = await exportWorkspaceArchive(repo);
    const written = await writeSnapshot(bytes, now);
    if (written) await saveBackupSettings(repo, { lastBackupAt: now });
    await mirrorExternal(repo, bytes, now);
    return written;
  } catch (err) {
    console.warn('[writer] auto-backup failed', err);
    return false;
  }
}

export type ManualBackupResult = DeliverResult | 'mirrored';

/**
 * "Back up now". With an external folder connected: a local snapshot plus a mirror into that
 * folder, no picker. Otherwise: the whole workspace through the file picker / browser download.
 */
export async function manualBackup(
  repo: NovelRepository,
  now = Date.now(),
): Promise<ManualBackupResult> {
  const bytes = await exportWorkspaceArchive(repo);
  if ((await loadBackupSettings(repo)).safFolderUri) {
    await writeSnapshot(bytes, now).catch(() => false);
    if (await mirrorExternal(repo, bytes, now)) {
      await saveBackupSettings(repo, { lastBackupAt: now });
      return 'mirrored';
    }
    throw new Error(
      `${(await loadBackupSettings(repo)).lastSafMirrorError ?? 'Mirror failed'}. A copy was kept on this device — reconnect the folder or export a .zip.`,
    );
  }
  return exportBackupFile(repo, now, bytes);
}

/** The whole workspace as one `.zip` through the file picker / browser download. */
export async function exportBackupFile(
  repo: NovelRepository,
  now = Date.now(),
  archive?: Uint8Array,
): Promise<DeliverResult> {
  const bytes = archive ?? (await exportWorkspaceArchive(repo));
  const day = new Date(now).toISOString().slice(0, 10);
  const name = `${fileStem('kinetic-writer-backup')}-${day}.zip`;
  const result = await deliverBytes(name, bytes, 'application/zip');
  if (result === 'saved') await saveBackupSettings(repo, { lastBackupAt: now });
  return result;
}
