// Device settings: appearance, where the Live Preview finds apps/reader, and the demo reset.
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  previewUrl,
  saveSettings,
} from '../settings/app-settings.ts';
import { useRepository } from '../store/context.tsx';
import { loadDemoNovel } from '../store/demo.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import { Field } from '../ui/Field.tsx';
import { ListRow, Page, SectionLabel } from '../ui/Page.tsx';
import { BackupSection } from '../backup/BackupSection.tsx';
import { routes } from '../routes.ts';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';

export default function AppSettingsScreen(): ReactNode {
  const repo = useRepository();
  const confirm = useConfirm();
  const theme = useTheme();
  const [readerUrl, setReaderUrl] = useState<string | null>(null);
  useEffect(() => {
    void loadSettings(repo).then((s) => setReaderUrl(s.readerUrl));
  }, [repo]);
  if (readerUrl === null) return null;
  const valid = previewUrl(readerUrl) !== null;
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
      <ListRow
        icon="type"
        title="Appearance & fonts"
        subtitle="Fonts, size, margins and editor layout"
        detail={theme.label}
        last
        testID="open-appearance"
        onPress={() => router.push(routes.appearance)}
      />
      <SectionLabel>Live preview</SectionLabel>
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
      <BackupSection />
      <SectionLabel>Privacy & integrity</SectionLabel>
      <ListRow
        icon="lock"
        title="Master Lock"
        subtitle="PIN, biometric unlock and recovery code"
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
      <SectionLabel>Demo</SectionLabel>
      <ListRow
        icon="rotate-ccw"
        title="Reset demo novel"
        subtitle="Restore Chrome Tide to its original state"
        destructive
        last
        testID="reset-demo"
        onPress={() => void resetDemo()}
      />
    </Page>
  );
}
