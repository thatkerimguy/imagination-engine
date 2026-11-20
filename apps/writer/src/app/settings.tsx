// Device settings: where the Live Preview finds apps/reader.
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  previewUrl,
  saveSettings,
} from '../settings/app-settings.ts';
import { useRepository } from '../store/context.tsx';
import { Button } from '../ui/Button.tsx';
import { Card, Muted, Row, screenStyles, SectionTitle } from '../ui/layout.tsx';
import { TextField } from '../ui/TextField.tsx';

export default function AppSettingsScreen(): ReactNode {
  const repo = useRepository();
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
  return (
    <ScrollView style={screenStyles.screen} contentContainerStyle={screenStyles.content}>
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
          <Button variant="primary" label="Save" disabled={!valid} onPress={() => void save()} />
          <Button
            variant="ghost"
            label="Reset"
            onPress={() => setReaderUrl(DEFAULT_SETTINGS.readerUrl)}
          />
        </Row>
      </Card>
    </ScrollView>
  );
}
