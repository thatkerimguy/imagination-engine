// Device settings: appearance, where the Live Preview finds apps/reader, and the demo reset.
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  previewUrl,
  saveSettings,
} from '../settings/app-settings.ts';
import { useRepository } from '../store/context.tsx';
import { loadDemoNovel } from '../store/demo.ts';
import { Button } from '../ui/Button.tsx';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import { Card, Muted, Row, Screen, SectionTitle } from '../ui/layout.tsx';
import { routes } from '../routes.ts';
import { TextField } from '../ui/TextField.tsx';
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
    <Screen>
      <SectionTitle>Appearance</SectionTitle>
      <Card>
        <Muted>{`Theme: ${theme.label} · fonts, size, margins and editor layout`}</Muted>
        <Row>
          <Button
            variant="tonal"
            icon="palette"
            label="Appearance & fonts"
            testID="open-appearance"
            onPress={() => router.push(routes.appearance)}
          />
        </Row>
      </Card>
      <SectionTitle>Live preview</SectionTitle>
      <Card>
        <TextField
          label="Reader preview URL"
          value={readerUrl}
          onChangeText={setReaderUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder={DEFAULT_SETTINGS.readerUrl}
          error={valid ? null : 'Enter an http:// or https:// address'}
          help="Your apps/reader server. On a phone, use your computer's LAN address (e.g. http://192.168.1.20:5173/) or a deployed reader."
        />
        <Muted>The writer opens this address with ?preview=1 and sends your draft to it.</Muted>
        <Row>
          <Button variant="filled" label="Save" disabled={!valid} onPress={() => void save()} />
          <Button
            variant="text"
            label="Reset"
            onPress={() => setReaderUrl(DEFAULT_SETTINGS.readerUrl)}
          />
        </Row>
      </Card>
      <SectionTitle>Demo</SectionTitle>
      <Row>
        <Button
          variant="outlined"
          label="Reset demo novel"
          onPress={() => void resetDemo()}
          testID="reset-demo"
        />
      </Row>
    </Screen>
  );
}
