// App Settings root: four calm hubs. Writing & Display (appearance, language, default workspace,
// haptics) · Data & Backup (backups, Trash, Document Doctor) · Publishing & Web (one row into the
// Publishing sub-screen) · Privacy & About (lock, crash reports, help, demo reset). Dense forms
// live on their own pushed sub-screens so novelists never scroll past developer fields.
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { loadSettings, saveSettings } from '../settings/app-settings.ts';
import { DefaultWorkspaceRow } from '../settings/DefaultWorkspaceRow.tsx';
import { hapticTestSequence, setHapticsEnabled } from '../ui/haptics.ts';
import { Toggle } from '../ui/Toggle.tsx';
import { useRepoQuery, useRepository } from '../store/context.tsx';
import { loadDemoNovel } from '../store/demo.ts';
import { listTrashedItems } from '../store/trash.ts';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import { CardGroup } from '../ui/CardGroup.tsx';
import { ListRow, Page, SectionLabel } from '../ui/Page.tsx';
import { applyCrashReporting } from '../observability/reporter.ts';
import { routes } from '../routes.ts';
import { LanguageRow } from '../i18n/LanguageRow.tsx';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { useTheme, useWriterPrefs } from '../ui/theme.tsx';

export default function AppSettingsScreen(): ReactNode {
  const repo = useRepository();
  const { t, tn } = useI18n();
  const confirm = useConfirm();
  const theme = useTheme();
  const [prefs, updatePrefs] = useWriterPrefs();
  const [crashOn, setCrashOn] = useState(false);
  const trashCount = useRepoQuery('trash-count', async (r) => (await listTrashedItems(r)).length);
  useEffect(() => {
    let live = true;
    void loadSettings(repo).then((s) => live && setCrashOn(s.crashReportingEnabled));
    return () => {
      live = false;
    };
  }, [repo]);
  const toggleHaptics = (on: boolean): void => {
    setHapticsEnabled(on);
    updatePrefs({ hapticsEnabled: on });
  };
  const toggleCrash = (on: boolean): void => {
    setCrashOn(on);
    void saveSettings(repo, { crashReportingEnabled: on }).then(() => applyCrashReporting(on));
  };
  const resetDemo = async (): Promise<void> => {
    const ok = await confirm({
      title: t('settings.resetDemo'),
      message: t('settings.resetDemoMessage'),
      confirmLabel: t('common.reset'),
      destructive: true,
    });
    if (ok) await loadDemoNovel(repo);
  };
  return (
    <Page testID="settings-root">
      <SectionLabel>{t('settings.hub.writing')}</SectionLabel>
      <CardGroup testID="card-appearance">
        <ListRow
          icon="type"
          title={t('settings.appearanceRow')}
          subtitle={t('settings.appearanceSub')}
          detail={theme.label}
          last
          testID="open-appearance"
          onPress={() => router.push(routes.appearance)}
        />
      </CardGroup>
      <LanguageRow />
      <CardGroup testID="card-workspace">
        <DefaultWorkspaceRow />
      </CardGroup>
      <CardGroup testID="card-haptics">
        <ListRow
          icon="smartphone"
          title={t('settings.haptics')}
          subtitle={t('settings.hapticsSub')}
          testID="settings-haptics-row"
          trailing={
            <Toggle
              value={prefs.hapticsEnabled}
              onValueChange={toggleHaptics}
              accessibilityLabel={t('settings.haptics')}
              testID="settings-haptics"
            />
          }
        />
        <ListRow
          icon="zap"
          title={t('settings.testVibration')}
          last
          testID="settings-haptics-test"
          onPress={() => void hapticTestSequence()}
        />
      </CardGroup>

      <SectionLabel>{t('settings.hub.data')}</SectionLabel>
      <CardGroup testID="card-data">
        <ListRow
          icon="download"
          title={t('settings.backupRow')}
          subtitle={t('settings.backupRowSub')}
          testID="open-backup"
          onPress={() => router.push(routes.settingsBackup)}
        />
        <ListRow
          icon="trash-2"
          title={tn('settings.trashRow', trashCount.data ?? 0)}
          subtitle={t('settings.trashSub')}
          testID="open-trash"
          onPress={() => router.push(routes.trash)}
        />
        <ListRow
          icon="activity"
          title={t('settings.doctor')}
          subtitle={t('settings.doctorSub')}
          last
          testID="open-doctor"
          onPress={() => router.push(routes.doctor)}
        />
      </CardGroup>

      <SectionLabel>{t('settings.hub.publishing')}</SectionLabel>
      <CardGroup testID="card-web">
        <ListRow
          icon="globe"
          title={t('settings.publishingRow')}
          subtitle={t('settings.publishingRowSub')}
          last
          testID="open-publishing"
          onPress={() => router.push(routes.settingsPublishing)}
        />
      </CardGroup>

      <SectionLabel>{t('settings.hub.privacy')}</SectionLabel>
      <CardGroup testID="card-privacy">
        <ListRow
          icon="lock"
          title={t('settings.lock')}
          subtitle={t('settings.lockSub')}
          testID="open-lock"
          onPress={() => router.push(routes.lock)}
        />
        <ListRow
          icon="shield"
          title={t('settings.crash')}
          subtitle={t('settings.crashSub')}
          subtitleLines={3}
          testID="settings-crash-row"
          trailing={
            <Toggle
              value={crashOn}
              onValueChange={toggleCrash}
              accessibilityLabel={t('settings.crash')}
              testID="settings-crash-reports"
            />
          }
        />
        <ListRow
          icon="help-circle"
          title={t('settings.helpRow')}
          subtitle={t('settings.helpSub')}
          testID="open-help"
          onPress={() => router.push(routes.help)}
        />
        <ListRow
          icon="rotate-ccw"
          title={t('settings.resetDemo')}
          subtitle={t('settings.resetDemoSub')}
          destructive
          last
          testID="reset-demo"
          onPress={() => void resetDemo()}
        />
      </CardGroup>
    </Page>
  );
}
