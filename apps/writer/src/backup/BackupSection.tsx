// Settings section: freshness badge, back up now, external (SAF) folder, restore, auto-backup
// interval, the device-transfer note and the Trash entry.
// Drop into the settings screen as `<BackupSection settings={…} />` (loaded by the parent).
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { readAssetBytes } from '../import/read-asset.ts';
import { routes } from '../routes.ts';
import { useRepoQuery, useRepository } from '../store/context.tsx';
import { listTrashedItems } from '../store/trash.ts';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import { CardGroup } from '../ui/CardGroup.tsx';
import { ListRow, SectionLabel } from '../ui/Page.tsx';
import { SegmentControl } from '../ui/SegmentControl.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { peekArchive, restoreArchive } from './archive-repo.ts';
import { exportBackupFile, manualBackup } from './auto-backup.ts';
import {
  DEFAULT_BACKUP_SETTINGS,
  loadBackupSettings,
  saveBackupSettings,
  type BackupInterval,
  type BackupSettings,
} from './backup-settings.ts';
import { ExternalFolderRow } from './ExternalFolderRow.tsx';
import { backupFreshness } from './saf-names.ts';

const INTERVALS: readonly { value: `${BackupInterval}`; label: string }[] = [
  { value: '0', label: 'Off' },
  { value: '6', label: '6 h' },
  { value: '24', label: 'Daily' },
  { value: '168', label: 'Weekly' },
];

const TONE = { none: 'inkMuted', fresh: 'success', stale: 'warm' } as const;

const when = (t: number | null): string => (t === null ? 'Never' : new Date(t).toLocaleString());
const msg = (e: unknown): string => (e instanceof Error ? e.message : 'Something went wrong.');

export function BackupSection({
  settings: initial,
}: {
  settings: BackupSettings | null;
}): ReactNode {
  const repo = useRepository();
  const confirm = useConfirm();
  const { colors } = useTheme();
  const [settings, setSettings] = useState<BackupSettings | null>(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const reload = useCallback(() => void loadBackupSettings(repo).then(setSettings), [repo]);
  useEffect(() => setSettings((cur) => initial ?? cur), [initial]);

  const guard = async (job: () => Promise<string | null>): Promise<void> => {
    setBusy(true);
    setNote(null);
    try {
      const text = await job();
      if (text) setNote({ text, error: false });
    } catch (err) {
      setNote({ text: msg(err), error: true });
    } finally {
      setBusy(false);
      reload();
    }
  };

  const trashCount = useRepoQuery('trash-count', async (r) => (await listTrashedItems(r)).length);
  const backUp = (): Promise<void> =>
    guard(async () => {
      const result = await manualBackup(repo);
      if (result === 'mirrored')
        return `Backed up to ${settings?.safFolderLabel ?? 'your folder'}.`;
      return result === 'saved' ? 'Backup saved.' : null;
    });
  const exportZip = (): Promise<void> =>
    guard(async () => ((await exportBackupFile(repo)) === 'saved' ? 'Backup saved.' : null));
  const changeFolder = (patch: Parameters<typeof saveBackupSettings>[1]): Promise<void> =>
    guard(async () => {
      setSettings(await saveBackupSettings(repo, patch));
      return patch.safFolderUri ? `Backups will also be copied to ${patch.safFolderLabel}.` : null;
    });
  const fresh = backupFreshness(settings?.lastBackupAt ?? null, Date.now());
  const items = trashCount.data ?? 0;
  const external = !!settings?.safFolderUri;

  const restore = (): Promise<void> =>
    guard(async () => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      const asset = picked.canceled ? undefined : picked.assets[0];
      if (!asset) return null;
      if (!/\.(zip|knbook)$/i.test(asset.name))
        throw new Error('Choose a backup (.zip) or a book (.knbook) file.');
      const bytes = await readAssetBytes(asset);
      const info = await peekArchive(bytes).catch((err: unknown) => {
        const why = err instanceof Error && err.message ? ` (${err.message})` : '';
        throw new Error(`“${asset.name}” is not a valid backup file${why}.`);
      });
      const whole = info.kind === 'workspace';
      const ok = await confirm({
        title: whole ? 'Restore everything' : 'Restore book',
        message: whole
          ? `Replace all writing on this device with the backup from ${when(info.createdAt)}? Your lock settings are kept.`
          : `Add “${info.title ?? 'this book'}” to your library? A book with the same id is overwritten.`,
        confirmLabel: 'Restore',
        destructive: whole,
      });
      if (!ok) return null;
      const result = await restoreArchive(repo, bytes);
      return `Restored ${result.keys} items.`;
    });

  const setInterval = async (value: string): Promise<void> => {
    const hours = Number(value) as BackupInterval;
    setSettings(await saveBackupSettings(repo, { intervalHours: hours }));
  };

  return (
    <View style={styles.root}>
      <SectionLabel>Backup & restore</SectionLabel>
      <View style={styles.badge} testID="backup-freshness" accessibilityLiveRegion="polite">
        <View style={[styles.dot, { backgroundColor: colors[TONE[fresh.tone]] }]} />
        <Txt variant="label" color={TONE[fresh.tone]}>
          {fresh.label}
        </Txt>
      </View>
      <CardGroup testID="card-backup">
        <ListRow
          icon="download"
          title="Back up now"
          subtitle={
            external
              ? `Snapshot on this device + a copy in ${settings?.safFolderLabel ?? 'your folder'}`
              : 'Save every book and note as one .zip'
          }
          last
          testID="backup-now"
          onPress={() => void (busy || backUp())}
        />
        <ExternalFolderRow settings={settings} busy={busy} onChange={changeFolder} />
        {external ? (
          <ListRow
            icon="share"
            title="Export a .zip copy"
            subtitle="Save the whole workspace anywhere"
            last
            testID="backup-export-zip"
            onPress={() => void (busy || exportZip())}
          />
        ) : null}
        <ListRow
          icon="upload"
          title="Restore from backup"
          subtitle="A workspace .zip or a .knbook"
          last
          testID="backup-restore"
          onPress={() => void (busy || restore())}
        />
        <ListRow
          icon="clock"
          title="Last backup"
          detail={settings ? when(settings.lastBackupAt) : ' '}
          last
        />
        <View style={styles.interval}>
          <Txt variant="label" color="inkSecondary">
            Auto-backup (emergency snapshots on this device)
          </Txt>
          <SegmentControl
            options={INTERVALS}
            value={`${(settings ?? DEFAULT_BACKUP_SETTINGS).intervalHours}`}
            onChange={(v) => void setInterval(v)}
            accessibilityLabel="Auto-backup interval"
            testID="backup-interval"
          />
        </View>
      </CardGroup>
      <Txt variant="meta" color="inkMuted" testID="backup-transfer-note">
        Device transfer excludes local manuscripts for privacy—use an external backup folder or
        export a .zip before switching phones.
      </Txt>
      <CardGroup testID="card-trash">
        <ListRow
          icon="trash-2"
          title={`Trash · ${items} ${items === 1 ? 'item' : 'items'}`}
          subtitle="Deleted books, chapters and notes are kept for 30 days"
          last
          testID="open-trash"
          onPress={() => router.push(routes.trash)}
        />
      </CardGroup>
      {note ? (
        <Txt
          variant="meta"
          color={note.error ? 'danger' : 'inkSecondary'}
          accessibilityLiveRegion="polite"
          testID="backup-note"
        >
          {note.text}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  interval: { gap: space.xs, paddingVertical: space.sm, paddingHorizontal: space.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: -space.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
