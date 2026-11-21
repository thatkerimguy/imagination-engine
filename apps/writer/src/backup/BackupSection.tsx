// Settings section: back up now, restore from a backup file, auto-backup interval.
// Drop into the settings screen as `<BackupSection settings={…} />` (loaded by the parent).
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { readAssetBytes } from '../import/read-asset.ts';
import { useRepository } from '../store/context.tsx';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import { CardGroup } from '../ui/CardGroup.tsx';
import { ListRow, SectionLabel } from '../ui/Page.tsx';
import { SegmentControl } from '../ui/SegmentControl.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { peekArchive, restoreArchive } from './archive-repo.ts';
import { manualBackup } from './auto-backup.ts';
import {
  DEFAULT_BACKUP_SETTINGS,
  loadBackupSettings,
  saveBackupSettings,
  type BackupInterval,
  type BackupSettings,
} from './backup-settings.ts';

const INTERVALS: readonly { value: `${BackupInterval}`; label: string }[] = [
  { value: '0', label: 'Off' },
  { value: '6', label: '6 h' },
  { value: '24', label: 'Daily' },
  { value: '168', label: 'Weekly' },
];

const when = (t: number | null): string => (t === null ? 'Never' : new Date(t).toLocaleString());
const msg = (e: unknown): string => (e instanceof Error ? e.message : 'Something went wrong.');

export function BackupSection({
  settings: initial,
}: {
  settings: BackupSettings | null;
}): ReactNode {
  const repo = useRepository();
  const confirm = useConfirm();
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

  const backUp = (): Promise<void> =>
    guard(async () => {
      await manualBackup(repo);
      return 'Backup created.';
    });

  const restore = (): Promise<void> =>
    guard(async () => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      const asset = picked.canceled ? undefined : picked.assets[0];
      if (!asset) return null;
      const bytes = await readAssetBytes(asset);
      const info = await peekArchive(bytes);
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
      <CardGroup testID="card-backup">
        <ListRow
          icon="download"
          title="Back up now"
          subtitle="Save every book and note as one .zip"
          last
          testID="backup-now"
          onPress={() => void (busy || backUp())}
        />
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
  interval: { gap: space.xs, paddingVertical: space.sm },
});
