// Settings › Data & Backup › Backups & External Folder: back up now, SAF folder, restore and the
// auto-backup interval on their own pushed screen (keyboard-aware PageScroll via Page).
import { useEffect, useState, type ReactNode } from 'react';
import { BackupSection } from '../backup/BackupSection.tsx';
import { loadBackupSettings, type BackupSettings } from '../backup/backup-settings.ts';
import { useRepository } from '../store/context.tsx';
import { Page } from '../ui/Page.tsx';

export default function BackupSettingsScreen(): ReactNode {
  const repo = useRepository();
  const [backup, setBackup] = useState<BackupSettings | null>(null);
  useEffect(() => {
    let live = true;
    void loadBackupSettings(repo).then((b) => live && setBackup(b));
    return () => {
      live = false;
    };
  }, [repo]);
  return (
    <Page testID="settings-backup-screen">
      <BackupSection settings={backup} />
    </Page>
  );
}
