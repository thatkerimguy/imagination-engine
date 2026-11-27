// Settings › Backups & External Folder: freshness badge, back up now, external (SAF) folder,
// restore, auto-backup interval and the device-transfer note. Trash lives on the Settings root.
// Drop into a screen as `<BackupSection settings={…} />` (loaded by the parent).
import { maybeRequestReview } from '../settings/review-request';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { readAssetBytes } from '../import/read-asset.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { relativeTime } from '../library/relative-time.ts';
import { useRepository } from '../store/context.tsx';
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

const INTERVALS = ['0', '6', '24', '168'] as const satisfies readonly `${BackupInterval}`[];
const intervalKey = (v: (typeof INTERVALS)[number]) =>
  v === '0' ? ('backup.interval.off' as const) : (`backup.interval.${v}` as const);

const TONE = { none: 'inkMuted', fresh: 'success', stale: 'warm' } as const;

export function BackupSection({
  settings: initial,
}: {
  settings: BackupSettings | null;
}): ReactNode {
  const repo = useRepository();
  const confirm = useConfirm();
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const when = (at: number | null): string =>
    at === null ? t('backup.never') : new Date(at).toLocaleString();
  const msg = (e: unknown): string => (e instanceof Error ? e.message : t('common.somethingWrong'));
  const [settings, setSettings] = useState<BackupSettings | null>(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const reload = useCallback(() => void loadBackupSettings(repo).then(setSettings), [repo]);
  useEffect(() => setSettings((cur) => initial ?? cur), [initial]);
  const folder = settings?.safFolderLabel ?? t('backup.yourFolder');

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
      const result = await manualBackup(repo);
      if (result === 'mirrored' || result === 'saved') void maybeRequestReview(repo, 'backup');
      if (result === 'mirrored') return t('backup.mirrored', { folder });
      return result === 'saved' ? t('backup.saved') : null;
    });
  const exportZip = (): Promise<void> =>
    guard(async () => ((await exportBackupFile(repo)) === 'saved' ? t('backup.saved') : null));
  const changeFolder = (patch: Parameters<typeof saveBackupSettings>[1]): Promise<void> =>
    guard(async () => {
      setSettings(await saveBackupSettings(repo, patch));
      return patch.safFolderUri
        ? t('backup.folderSet', { folder: patch.safFolderLabel ?? folder })
        : null;
    });
  const fresh = backupFreshness(settings?.lastBackupAt ?? null, Date.now());
  const freshLabel =
    settings?.lastBackupAt == null
      ? t('backup.fresh.none')
      : t('backup.fresh.at', { when: relativeTime(settings.lastBackupAt, Date.now(), locale) });
  const external = !!settings?.safFolderUri;

  const restore = (): Promise<void> =>
    guard(async () => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      const asset = picked.canceled ? undefined : picked.assets[0];
      if (!asset) return null;
      if (!/\.(zip|knbook)$/i.test(asset.name)) throw new Error(t('backup.badFile'));
      const bytes = await readAssetBytes(asset);
      const info = await peekArchive(bytes).catch((err: unknown) => {
        const why = err instanceof Error && err.message ? ` (${err.message})` : '';
        throw new Error(`${t('backup.invalid', { name: asset.name })}${why}`);
      });
      const whole = info.kind === 'workspace';
      const ok = await confirm({
        title: whole ? t('backup.restoreAll') : t('backup.restoreBook'),
        message: whole
          ? t('backup.restoreAllMsg', { when: when(info.createdAt) })
          : t('backup.restoreBookMsg', { title: info.title ?? t('backup.thisBook') }),
        confirmLabel: t('backup.restoreConfirm'),
        destructive: whole,
      });
      if (!ok) return null;
      const result = await restoreArchive(repo, bytes);
      return t('backup.restored', { n: result.keys });
    });

  const setInterval = async (value: string): Promise<void> => {
    const hours = Number(value) as BackupInterval;
    setSettings(await saveBackupSettings(repo, { intervalHours: hours }));
  };

  return (
    <View style={styles.root}>
      <SectionLabel>{t('backup.title')}</SectionLabel>
      <View style={styles.badge} testID="backup-freshness" accessibilityLiveRegion="polite">
        <View style={[styles.dot, { backgroundColor: colors[TONE[fresh.tone]] }]} />
        <Txt variant="label" color={TONE[fresh.tone]}>
          {freshLabel}
        </Txt>
      </View>
      <CardGroup testID="card-backup">
        <ListRow
          icon="download"
          title={t('backup.now')}
          subtitle={external ? t('backup.nowSubExternal', { folder }) : t('backup.nowSub')}
          last
          testID="backup-now"
          onPress={() => void (busy || backUp())}
        />
        <ExternalFolderRow settings={settings} busy={busy} onChange={changeFolder} />
        {external ? (
          <ListRow
            icon="share"
            title={t('backup.exportZip')}
            subtitle={t('backup.exportZipSub')}
            last
            testID="backup-export-zip"
            onPress={() => void (busy || exportZip())}
          />
        ) : null}
        <ListRow
          icon="upload"
          title={t('backup.restore')}
          subtitle={t('backup.restoreSub')}
          last
          testID="backup-restore"
          onPress={() => void (busy || restore())}
        />
        <ListRow
          icon="clock"
          title={t('backup.last')}
          detail={settings ? when(settings.lastBackupAt) : ' '}
          last
        />
        <View style={styles.interval}>
          <Txt variant="label" color="inkSecondary">
            {t('backup.auto')}
          </Txt>
          <SegmentControl
            options={INTERVALS.map((v) => ({ value: v, label: t(intervalKey(v)) }))}
            value={`${(settings ?? DEFAULT_BACKUP_SETTINGS).intervalHours}`}
            onChange={(v) => void setInterval(v)}
            accessibilityLabel={t('backup.autoA11y')}
            testID="backup-interval"
          />
        </View>
      </CardGroup>
      <Txt variant="meta" color="inkMuted" testID="backup-transfer-note">
        {t('backup.transferNote')}
      </Txt>
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
