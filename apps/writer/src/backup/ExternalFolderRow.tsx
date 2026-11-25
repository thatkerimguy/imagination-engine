// Settings row: "External backup folder (survives uninstall)". Android: pick / change /
// disconnect a visible SAF folder and see the last mirror status. Elsewhere: an Android-only note.
import type { ReactNode } from 'react';
import { relativeTime } from '../library/relative-time.ts';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import { ListRow } from '../ui/Page.tsx';
import type { BackupSettings } from './backup-settings.ts';
import { pickSafFolder, SAF_SUPPORTED } from './saf-mirror';

type SafField = 'safFolderUri' | 'safFolderLabel' | 'lastSafMirrorAt' | 'lastSafMirrorError';

const TITLE = 'External backup folder (survives uninstall)';

function status(s: BackupSettings | null): string {
  if (!s?.safFolderUri) return 'Pick a visible folder, e.g. Documents/ImaginationEngine';
  if (s.lastSafMirrorError)
    return `${s.safFolderLabel} · Last copy failed: ${s.lastSafMirrorError}`;
  const at = s.lastSafMirrorAt ? Date.parse(s.lastSafMirrorAt) : NaN;
  const last = Number.isNaN(at) ? 'no copy yet' : `copied ${relativeTime(at)}`;
  return `${s.safFolderLabel} · ${last}`;
}

export function ExternalFolderRow(p: {
  settings: BackupSettings | null;
  busy: boolean;
  /** Saves a settings patch (undefined clears a field) and refreshes the section. */
  onChange(patch: Partial<Record<SafField, string | undefined>>): Promise<void>;
}): ReactNode {
  const confirm = useConfirm();
  if (!SAF_SUPPORTED) {
    return (
      <ListRow
        icon="hard-drive"
        title={TITLE}
        subtitle="Android only — on this device, use “Back up now” to save a .zip."
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
      title: 'Disconnect folder?',
      message: 'Backups already in the folder stay there. New snapshots stay on this device only.',
      confirmLabel: 'Disconnect',
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
        title={TITLE}
        subtitle={status(p.settings)}
        detail={connected ? 'Change' : 'Choose'}
        last
        testID="backup-external-folder"
        onPress={() => void (p.busy || pick())}
      />
      {connected ? (
        <ListRow
          icon="x-circle"
          title="Disconnect folder"
          last
          testID="backup-external-disconnect"
          onPress={() => void (p.busy || disconnect())}
        />
      ) : null}
    </>
  );
}
