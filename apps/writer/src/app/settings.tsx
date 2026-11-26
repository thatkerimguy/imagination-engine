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
import { routes } from '../routes.ts';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme, useWriterPrefs } from '../ui/theme.tsx';

const MODE_SEGMENTS: readonly SegmentOption<PreviewMode>[] = [
  { value: 'offline', label: 'Built-in (Offline)', testID: 'settings-preview-offline' },
  { value: 'custom-url', label: 'Custom URL', testID: 'settings-preview-custom' },
];

export default function AppSettingsScreen(): ReactNode {
  const repo = useRepository();
  const confirm = useConfirm();
  const theme = useTheme();
  const [prefs, updatePrefs] = useWriterPrefs();
  const [readerUrl, setReaderUrl] = useState(DEFAULT_SETTINGS.readerUrl);
  const [mode, setMode] = useState<PreviewMode>(DEFAULT_SETTINGS.previewMode);
  const [backup, setBackup] = useState<BackupSettings | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.all([loadSettings(repo), loadBackupSettings(repo)]).then(([s, b]) => {
      if (!live) return;
      setMode(s.previewMode);
      setReaderUrl(s.readerUrl);
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
  const valid = mode === 'offline' || previewUrl(readerUrl) !== null;
  const save = async (): Promise<void> => {
    await saveSettings(repo, { readerUrl: readerUrl.trim() });
    router.back();
  };
  const resetDemo = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Reset demo novel',
      message: 'Reset the demo novel to its original state?',
      confirmLabel: 'Reset',
      destructive: true,
    });
    if (ok) await loadDemoNovel(repo);
  };
  return (
    <Page>
      <SectionLabel>Appearance</SectionLabel>
      <CardGroup testID="card-appearance">
        <ListRow
          icon="type"
          title="Appearance & fonts"
          subtitle="Fonts, size, margins and editor layout"
          detail={theme.label}
          last
          testID="open-appearance"
          onPress={() => router.push(routes.appearance)}
        />
      </CardGroup>
      <SectionLabel>Live preview</SectionLabel>
      <CardGroup testID="card-preview">
        <View style={{ gap: space.sm, padding: space.md }}>
          <SegmentControl<PreviewMode>
            options={MODE_SEGMENTS}
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
      <SectionLabel>Haptics</SectionLabel>
      <CardGroup testID="card-haptics">
        <ListRow
          icon="smartphone"
          title="Haptics"
          subtitle="Subtle taps on buttons and toggles"
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
          title="Test vibration"
          last
          testID="settings-haptics-test"
          onPress={() => void hapticTestSequence()}
        />
      </CardGroup>
      <BackupSection settings={backup} />
      <PublishSettingsCard />
      <SectionLabel>Privacy & integrity</SectionLabel>
      <CardGroup testID="card-privacy">
        <ListRow
          icon="lock"
          title="Master Lock"
          subtitle="PIN, biometric unlock and recovery code"
          last
          testID="open-lock"
          onPress={() => router.push(routes.lock)}
        />
        <ListRow
          icon="activity"
          title="Document Doctor"
          subtitle="Scan for damaged or orphaned entries"
          last
          testID="open-doctor"
          onPress={() => router.push(routes.doctor)}
        />
      </CardGroup>
      <SectionLabel>Demo</SectionLabel>
      <CardGroup testID="card-demo">
        <ListRow
          icon="rotate-ccw"
          title="Reset demo novel"
          subtitle="Restore Chrome Tide to its original state"
          destructive
          last
          testID="reset-demo"
          onPress={() => void resetDemo()}
        />
      </CardGroup>
    </Page>
  );
}
