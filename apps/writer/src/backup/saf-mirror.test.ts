import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../storage/memory.ts';
import { NovelRepository } from '../store/repository.ts';
import { loadBackupSettings, saveBackupSettings } from './backup-settings.ts';
import {
  backupFreshness,
  safFolderLabel,
  safMirrorName,
  safMirrorsToPrune,
  safNameOf,
  STALE_AFTER_MS,
} from './saf-names.ts';

const tree =
  'content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FImaginationEngine';
const doc = (name: string): string =>
  `${tree}/document/primary%3ADocuments%2FImaginationEngine%2F${encodeURIComponent(name)}`;

describe('SAF mirror naming & retention', () => {
  it('names mirrors by local date and minute', () => {
    const at = new Date(2026, 10, 26, 9, 5).getTime();
    expect(safMirrorName(at)).toBe('kinetic-writer-auto-20261126-0905.zip');
  });

  it('reads display names and folder labels from SAF URIs', () => {
    expect(safNameOf(doc('kinetic-writer-auto-20261126-0905.zip'))).toBe(
      'kinetic-writer-auto-20261126-0905.zip',
    );
    expect(safFolderLabel(tree)).toBe('Documents/ImaginationEngine');
    expect(safFolderLabel('content://x/tree/primary%3A')).toBe('Internal storage');
    expect(safFolderLabel('content://x/tree/1A2B-3C4D%3ASync%2FBooks')).toBe('Sync/Books');
  });

  it('keeps the newest 5 mirrors and never touches other files', () => {
    const ours = [1, 2, 3, 4, 5, 6, 7].map((d) => doc(`kinetic-writer-auto-2026110${d}-1200.zip`));
    const dup = doc('kinetic-writer-auto-20261101-1200 (1).zip');
    const others = [
      doc('kinetic-writer-backup-2026-11-01.zip'),
      doc('holiday.jpg'),
      doc('kinetic-writer-auto-notes.zip'),
    ];
    const prune = safMirrorsToPrune([...others, ...ours, dup]);
    expect(prune.map(safNameOf).sort()).toEqual([
      'kinetic-writer-auto-20261101-1200 (1).zip',
      'kinetic-writer-auto-20261101-1200.zip',
      'kinetic-writer-auto-20261102-1200.zip',
    ]);
    for (const o of others) expect(prune).not.toContain(o);
    expect(safMirrorsToPrune(ours.slice(0, 5))).toEqual([]);
  });
});

describe('backup freshness badge', () => {
  const now = Date.parse('2026-11-26T12:00:00Z');
  it('formats never / just now / minutes ago', () => {
    expect(backupFreshness(null, now)).toEqual({ label: 'Not backed up yet', tone: 'none' });
    expect(backupFreshness(now - 10_000, now)).toEqual({
      label: 'Backed up just now',
      tone: 'fresh',
    });
    expect(backupFreshness(now - 4 * 60_000, now).label).toBe('Backed up 4 minutes ago');
    expect(backupFreshness(now - STALE_AFTER_MS - 1, now).tone).toBe('stale');
  });
});

describe('backup settings (external folder)', () => {
  it('stores, clears and normalizes the SAF fields', async () => {
    vi.useRealTimers();
    const repo = new NovelRepository(createMemoryAdapter());
    expect(await loadBackupSettings(repo)).toEqual({ intervalHours: 24, lastBackupAt: null });
    await saveBackupSettings(repo, {
      safFolderUri: tree,
      safFolderLabel: 'Documents/ImaginationEngine',
      lastSafMirrorError: 'Permission revoked',
    });
    const s = await saveBackupSettings(repo, {
      lastSafMirrorAt: '2026-11-26T12:00:00.000Z',
      lastSafMirrorError: undefined,
    });
    expect(s.safFolderLabel).toBe('Documents/ImaginationEngine');
    expect(s.lastSafMirrorError).toBeUndefined();
    const off = await saveBackupSettings(repo, {
      safFolderUri: undefined,
      safFolderLabel: undefined,
      lastSafMirrorAt: undefined,
    });
    expect(off).toEqual({ intervalHours: 24, lastBackupAt: null });
  });
});
