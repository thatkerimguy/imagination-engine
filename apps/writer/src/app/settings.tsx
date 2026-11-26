// Device settings: appearance, where the Live Preview finds apps/reader, and the demo reset.
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  previewUrl,
  saveSettings,
  type PreviewMode,
} from '../settings/app-settings.ts';
import { loadBackupSettings, type BackupSettings } from '../backup/backup-settings.ts';
import { hapticTestSequence, setHapticsEnabled } from '../ui/haptics.ts';
import { SegmentControl, type SegmentOption } from '../ui/SegmentControl.tsx';
import { Toggle } from '../ui/Toggle.tsx';
import { useRepository } from '../store/context.tsx';
import { loadDemoNovel } from '../store/demo.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import { CardGroup } from '../ui/CardGroup.tsx';
import { Field } from '../ui/Field.tsx';
import { ListRow, Page, SectionLabel } from '../ui/Page.tsx';
import { BackupSection } from '../backup/BackupSection.tsx';
import { PublishSettingsCard } from '../publish/PublishSettingsCard.tsx';
import { applyCrashReporting } from '../observability/reporter.ts';
import { routes } from '../routes.ts';
import { LanguageRow } from '../i18n/LanguageRow.tsx';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme, useWriterPrefs } from '../ui/theme.tsx';

export default function AppSettingsScreen(): ReactNode {
  const repo = useRepository();
  const { t } = useI18n();
  const modeSegments: readonly SegmentOption<PreviewMode>[] = [
    { value: 'offline', label: t('settings.previewBuiltIn'), testID: 'settings-preview-offline' },
    { value: 'custom-url', label: t('settings.previewCustom'), testID: 'settings-preview-custom' },
  ];
  const confirm = useConfirm();
  const theme = useTheme();
  const [prefs, updatePrefs] = useWriterPrefs();
  const [readerUrl, setReaderUrl] = useState(DEFAULT_SETTINGS.readerUrl);
  const [mode, setMode] = useState<PreviewMode>(DEFAULT_SETTINGS.previewMode);
  const [backup, setBackup] = useState<BackupSettings | null>(null);
  const [crashOn, setCrashOn] = useState(false);
  useEffect(() => {
    let live = true;
    void Promise.all([loadSettings(repo), loadBackupSettings(repo)]).then(([s, b]) => {
      if (!live) return;
      setMode(s.previewMode);
      setReaderUrl(s.readerUrl);
      setCrashOn(s.crashReportingEnabled);
      setBackup(b);
    });
    return () => {
      live = false;
    };
  }, [repo]);
  const pickMode = (next: PreviewMode): void => {
    setMode(next);
    void saveSettings(repo, { previewMode: next });
  };
  const toggleHaptics = (on: boolean): void => {
    setHapticsEnabled(on);
    updatePrefs({ hapticsEnabled: on });
  };
  const toggleCrash = (on: boolean): void => {
    setCrashOn(on);
    void saveSettings(repo, { crashReportingEnabled: on }).then(() => applyCrashReporting(on));
  };
  const valid = mode === 'offline' || previewUrl(readerUrl) !== null;
  const save = async (): Promise<void> => {
    await saveSettings(repo, { readerUrl: readerUrl.trim() });
    router.back();
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
    <Page>
      <SectionLabel>{t('settings.appearance')}</SectionLabel>
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
      <SectionLabel>{t('settings.livePreview')}</SectionLabel>
      <CardGroup testID="card-preview">
        <View style={{ gap: space.sm, padding: space.md }}>
          <SegmentControl<PreviewMode>
            options={modeSegments}
            value={mode}
            onChange={pickMode}
            accessibilityLabel="Live preview source"
            testID="settings-preview-mode"
          />
          {mode === 'offline' ? (
            <Txt variant="meta" color="inkSecondary">
              The preview runs a reader bundled inside the writer, so it works with no server or
              network.
            </Txt>
          ) : (
            <>
              <Field
                label="Reader preview URL"
                value={readerUrl}
                onChangeText={setReaderUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder={DEFAULT_SETTINGS.readerUrl}
                error={valid ? null : 'Enter an http:// or https:// address'}
                hint="Your apps/reader server. On a phone, use your computer's LAN address (e.g. http://192.168.1.20:5173/) or a deployed reader."
              />
              <Txt variant="meta" color="inkSecondary">
                The writer opens this address with ?preview=1 and sends your draft to it.
              </Txt>
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                <ActionButton label="Save" disabled={!valid} onPress={() => void save()} />
                <ActionButton
                  variant="ghost"
                  quiet
                  label="Reset"
                  onPress={() => setReaderUrl(DEFAULT_SETTINGS.readerUrl)}
                />
              </View>
            </>
          )}
        </View>
      </CardGroup>
      <SectionLabel>{t('settings.haptics')}</SectionLabel>
      <CardGroup testID="card-haptics">
        <ListRow
          icon="smartphone"
          title={t('settings.haptics')}
          subtitle={t('settings.hapticsSub')}
          last
          testID="settings-haptics-row"
          trailing={
            <Toggle
              value={prefs.hapticsEnabled}
              onValueChange={toggleHaptics}
              accessibilityLabel="Haptics"
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
      <BackupSection settings={backup} />
      <PublishSettingsCard />
      <SectionLabel>{t('settings.privacy')}</SectionLabel>
      <CardGroup testID="card-privacy">
        <ListRow
          icon="lock"
          title={t('settings.lock')}
          subtitle={t('settings.lockSub')}
          testID="open-lock"
          onPress={() => router.push(routes.lock)}
        />
        <ListRow
          icon="activity"
          title={t('settings.doctor')}
          subtitle={t('settings.doctorSub')}
          testID="open-doctor"
          onPress={() => router.push(routes.doctor)}
        />
        <ListRow
          icon="shield"
          title={t('settings.crash')}
          subtitle="Off by default. Sends crash stack traces only—never your writing, titles, or notes."
          subtitleLines={3}
          testID="settings-crash-row"
          trailing={
            <Toggle
              value={crashOn}
              onValueChange={toggleCrash}
              accessibilityLabel="Anonymous crash reports"
              testID="settings-crash-reports"
            />
          }
        />
        <ListRow
          icon="help-circle"
          title={t('settings.helpRow')}
          subtitle={t('settings.helpSub')}
          last
          testID="open-help"
          onPress={() => router.push(routes.help)}
        />
      </CardGroup>
      <SectionLabel>{t('settings.demo')}</SectionLabel>
      <CardGroup testID="card-demo">
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
