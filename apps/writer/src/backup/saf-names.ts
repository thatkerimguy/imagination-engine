// Pure helpers for the external (Storage Access Framework) backup folder: mirror file names,
// retention pruning, folder labels and the backup freshness badge. No platform imports.
import { relativeTime } from '../library/relative-time.ts';

/** Mirrored auto-snapshots kept in the external folder. */
export const SAF_MIRRORS_KEPT = 5;
export const SAF_MIRROR_PREFIX = 'kinetic-writer-auto-';
/** Ours only: `kinetic-writer-auto-YYYYMMDD-HHmm.zip`, plus a provider's ` (1)` de-dup suffix. */
export const SAF_MIRROR_NAME = /^kinetic-writer-auto-\d{8}-\d{4}(?: \(\d+\))?\.zip$/;

const pad = (n: number): string => String(n).padStart(2, '0');

/** `kinetic-writer-auto-20261126-0930.zip` (device-local time, sorts chronologically). */
export function safMirrorName(now: number): string {
  const d = new Date(now);
  const day = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `${SAF_MIRROR_PREFIX}${day}-${pad(d.getHours())}${pad(d.getMinutes())}.zip`;
}

/** The display name inside a SAF document URI (`…/document/primary%3ADocs%2Fname.zip`). */
export function safNameOf(uri: string): string {
  let s = uri;
  try {
    s = decodeURIComponent(uri);
  } catch {
    // keep raw
  }
  return s.slice(Math.max(s.lastIndexOf('/'), s.lastIndexOf(':')) + 1);
}

/**
 * Which of `uris` to delete so only the newest `keep` mirrored snapshots stay. Files that are
 * not ours (any other name) are never touched. Pure.
 */
export function safMirrorsToPrune(uris: readonly string[], keep = SAF_MIRRORS_KEPT): string[] {
  return uris
    .map((uri) => ({ uri, name: safNameOf(uri) }))
    .filter((f) => SAF_MIRROR_NAME.test(f.name))
    .sort((a, b) => b.name.localeCompare(a.name))
    .slice(keep)
    .map((f) => f.uri);
}

/** `content://…/tree/primary%3ADocuments%2FImaginationEngine` → `Documents/ImaginationEngine`. */
export function safFolderLabel(treeUri: string): string {
  let s = treeUri;
  try {
    s = decodeURIComponent(treeUri);
  } catch {
    // keep raw
  }
  const tree = s.split('/tree/')[1] ?? s;
  const path = tree.includes(':') ? tree.slice(tree.indexOf(':') + 1) : tree;
  const volume = tree.includes(':') ? tree.slice(0, tree.indexOf(':')) : '';
  if (path) return path.replace(/\/+$/, '');
  return volume === 'primary' ? 'Internal storage' : volume || 'Selected folder';
}

export type FreshnessTone = 'none' | 'fresh' | 'stale';

/** Older than this the badge turns to a warning tone. */
export const STALE_AFTER_MS = 7 * 24 * 3_600_000;

/** "Backed up just now" / "Backed up 4 minutes ago" / "Not backed up yet". Pure. */
export function backupFreshness(
  lastBackupAt: number | null,
  now: number,
): { label: string; tone: FreshnessTone } {
  if (lastBackupAt === null) return { label: 'Not backed up yet', tone: 'none' };
  return {
    label: `Backed up ${relativeTime(lastBackupAt, now)}`,
    tone: now - lastBackupAt > STALE_AFTER_MS ? 'stale' : 'fresh',
  };
}
