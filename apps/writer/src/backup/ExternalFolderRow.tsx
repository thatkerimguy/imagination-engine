// Settings row: "External backup folder (survives uninstall)". Android: pick / change /
// disconnect a visible SAF folder and see the last mirror status. Elsewhere: an Android-only note.
import type { ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { translator, type Locale, type Translate } from '../i18n/i18n.ts';
import { relativeTime } from '../library/relative-time.ts';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import { ListRow } from '../ui/Page.tsx';
import type { BackupSettings } from './backup-settings.ts';
import { pickSafFolder, SAF_SUPPORTED } from './saf-mirror';

type SafField = 'safFolderUri' | 'safFolderLabel' | 'lastSafMirrorAt' | 'lastSafMirrorError';

/** The row subtitle: pick hint, last-copy failure, or "<folder> · copied 5 minutes ago". */
export function folderStatus(
  s: BackupSettings | null,
  locale: Locale = 'en',
  t: Translate = translator(locale),
): string {
  if (!s?.safFolderUri) return t('backup.folder.pick');
  const folder = s.safFolderLabel ?? '';
  if (s.lastSafMirrorError)
    return t('backup.folder.failed', { folder, error: s.lastSafMirrorError });
  const at = s.lastSafMirrorAt ? Date.parse(s.lastSafMirrorAt) : NaN;
  const last = Number.isNaN(at)
    ? t('backup.folder.noCopy')
    : t('backup.folder.copied', { when: relativeTime(at, Date.now(), locale) });
  return `${folder} · ${last}`;
}

export function ExternalFolderRow(p: {
  settings: BackupSettings | null;
  busy: boolean;
  /** Saves a settings patch (undefined clears a field) and refreshes the section. */
  onChange(patch: Partial<Record<SafField, string | undefined>>): Promise<void>;
}): ReactNode {
  const confirm = useConfirm();
  const { t, locale } = useI18n();
  const title = t('backup.folder.title');
  if (!SAF_SUPPORTED) {
    return (
      <ListRow
        icon="hard-drive"
        title={title}
        subtitle={t('backup.folder.android')}
        last
        testID="backup-external-folder"
      />
    );
  }
  const pick = async (): Promise<void> => {
    const folder = await pickSafFolder();
    if (!folder) return;
    await p.onChange({
      safFolderUri: folder.uri,
      safFolderLabel: folder.label,
      lastSafMirrorAt: undefined,
      lastSafMirrorError: undefined,
    });
  };
  const disconnect = async (): Promise<void> => {
    const ok = await confirm({
      title: t('backup.folder.disconnectTitle'),
      message: t('backup.folder.disconnectMsg'),
      confirmLabel: t('backup.folder.disconnect'),
    });
    if (ok)
      await p.onChange({
        safFolderUri: undefined,
        safFolderLabel: undefined,
        lastSafMirrorAt: undefined,
        lastSafMirrorError: undefined,
      });
  };
  const connected = !!p.settings?.safFolderUri;
  return (
    <>
      <ListRow
        icon="hard-drive"
        title={title}
        subtitle={folderStatus(p.settings, locale, t)}
        detail={connected ? t('backup.folder.change') : t('backup.folder.choose')}
        last
        testID="backup-external-folder"
        onPress={() => void (p.busy || pick())}
      />
      {connected ? (
        <ListRow
          icon="x-circle"
          title={t('backup.folder.disconnectRow')}
          last
          testID="backup-external-disconnect"
          onPress={() => void (p.busy || disconnect())}
        />
      ) : null}
    </>
  );
}
