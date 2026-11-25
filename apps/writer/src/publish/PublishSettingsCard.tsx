// Settings section: publish API URL, author token and public reader URL + a connection test.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRepository } from '../store/context.tsx';
import { CardGroup } from '../ui/CardGroup.tsx';
import { Field } from '../ui/Field.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { Glyph } from '../ui/Glyph.tsx';
import { Dot, SectionLabel } from '../ui/Page.tsx';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { verifyPublishConnection } from './publish-client.ts';
import {
  clearPublishToken,
  isPublishConfigured,
  loadPublishConfig,
  loadPublishToken,
  normalizeBaseUrl,
  savePublishConfig,
  savePublishToken,
} from './publish-settings.ts';

type Status = { tone: 'ok' | 'bad' | 'busy' | 'info'; text: string };

const STATES: Record<string, Status> = {
  ok: { tone: 'ok', text: 'Connected' },
  unauthorized: { tone: 'bad', text: 'Invalid token' },
  unreachable: { tone: 'bad', text: 'Could not reach server' },
  misconfigured: { tone: 'bad', text: 'Server has no publish token set' },
};

const urlProps = {
  keyboardType: 'url',
  autoCapitalize: 'none',
  autoCorrect: false,
  spellCheck: false,
} as const;

export function PublishSettingsCard(): ReactNode {
  const repo = useRepository();
  const { colors } = useTheme();
  const [apiUrl, setApiUrl] = useState('');
  const [readerUrl, setReaderUrl] = useState('');
  const [token, setToken] = useState('');
  const [reveal, setReveal] = useState(false);
  const [errors, setErrors] = useState<{ api?: string; reader?: string }>({});
  const [status, setStatus] = useState<Status | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    let live = true;
    void Promise.all([loadPublishConfig(repo), loadPublishToken(repo)]).then(([c, t]) => {
      if (!live) return;
      setApiUrl(c.apiUrl);
      setReaderUrl(c.readerUrl);
      setToken(t);
      loaded.current = true;
    });
    return () => {
      live = false;
    };
  }, [repo]);

  /** Persists the three fields; returns false (and shows the reason) on an invalid URL. */
  const save = async (): Promise<boolean> => {
    if (!loaded.current) return false;
    const next: { api?: string; reader?: string } = {};
    if (normalizeBaseUrl(apiUrl) === null) next.api = 'Enter a full http(s) address.';
    if (normalizeBaseUrl(readerUrl) === null) next.reader = 'Enter a full http(s) address.';
    setErrors(next);
    if (next.api || next.reader) return false;
    try {
      await savePublishConfig(repo, { apiUrl, readerUrl });
      const trimmed = token.trim();
      if (trimmed) await savePublishToken(repo, trimmed);
      else await clearPublishToken(repo);
      return true;
    } catch (err) {
      setErrors({ api: err instanceof Error ? err.message : 'Could not save.' });
      return false;
    }
  };

  const test = async (): Promise<void> => {
    if (status?.tone === 'busy') return;
    if (!(await save())) return;
    const config = await loadPublishConfig(repo);
    const saved = await loadPublishToken(repo);
    if (!isPublishConfigured(config, saved)) {
      setStatus({ tone: 'info', text: 'Add the API URL and token first.' });
      return;
    }
    setStatus({ tone: 'busy', text: 'Checking…' });
    const result = await verifyPublishConnection(config.apiUrl, saved);
    setStatus(STATES[result.state] ?? { tone: 'bad', text: result.message });
  };

  const dot =
    status?.tone === 'ok'
      ? colors.success
      : status?.tone === 'bad'
        ? colors.danger
        : colors.inkMuted;
  const trailing = status ? (
    <View style={styles.status}>
      <Dot color={dot} />
      <Txt variant="meta" color="inkSecondary" testID="publish-test-status">
        {status.text}
      </Txt>
    </View>
  ) : undefined;

  return (
    <View style={styles.root}>
      <SectionLabel>Publishing</SectionLabel>
      <CardGroup testID="card-publishing">
        <View style={styles.fields}>
          <Field
            label="Publish API URL"
            value={apiUrl}
            onChangeText={setApiUrl}
            onBlur={() => void save()}
            onSubmitEditing={() => void save()}
            placeholder="https://kinetic-publish-api.example.workers.dev"
            error={errors.api}
            testID="publish-api-url"
            {...urlProps}
          />
          <View style={styles.tokenRow}>
            <View style={styles.grow}>
              <Field
                label="Author token"
                value={token}
                onChangeText={setToken}
                onBlur={() => void save()}
                onSubmitEditing={() => void save()}
                secureTextEntry={!reveal}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                testID="publish-token"
              />
            </View>
            <IconBtn
              icon={reveal ? 'eye-off' : 'eye'}
              accessibilityLabel={reveal ? 'Hide token' : 'Show token'}
              onPress={() => setReveal((v) => !v)}
              testID="publish-token-reveal"
            />
          </View>
          <Field
            label="Public reader URL"
            value={readerUrl}
            onChangeText={setReaderUrl}
            onBlur={() => void save()}
            onSubmitEditing={() => void save()}
            placeholder="https://reader.example.com"
            hint="Used to build the links you share."
            error={errors.reader}
            testID="publish-reader-url"
            {...urlProps}
          />
        </View>
        {/* Inset on both sides so the wifi glyph and "Connected" sit 12px inside the highlight. */}
        <Press
          accessibilityRole="button"
          accessibilityLabel="Test connection"
          onPress={() => void test()}
          testID="publish-test"
          style={styles.testRow}
        >
          <Glyph name="wifi" size={18} color="ink" />
          <Txt variant="body" numberOfLines={1} style={styles.grow}>
            Test connection
          </Txt>
          {trailing ?? <Glyph name="chevron-right" size={18} color="inkMuted" />}
        </Press>
      </CardGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  fields: { gap: space.md, paddingVertical: space.sm },
  tokenRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  grow: { flex: 1 },
  // Same 12px inset on both ends of the press highlight: wifi glyph left, status / chevron right.
  testRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingLeft: space.sm },
});
