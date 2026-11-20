// Live Preview: the real apps/reader in a WebView (iframe on web), fed the unsaved draft.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PreviewFrame } from '../preview/PreviewFrame';
import type { PreviewFrameHandle } from '../preview/frame-types.ts';
import { PREVIEW_TIERS, type PreviewTier, type ReaderMessage } from '../preview/protocol.ts';
import { usePreviewPayload } from '../preview/use-preview-payload.ts';
import { routes } from '../routes.ts';
import { Button } from '../ui/Button.tsx';
import { Chip } from '../ui/Chip.tsx';
import { EmptyState, Row } from '../ui/layout.tsx';
import { colors, space } from '../ui/theme.ts';

type Status = 'connecting' | 'live' | 'unreachable' | 'rejected';
const READY_TIMEOUT_MS = 8000;
const TIER_LABEL: Record<PreviewTier, string> = {
  auto: 'Auto',
  high: 'High',
  lite: 'Lite',
  reduced: 'Reduced',
};

export default function PreviewScreen(): ReactNode {
  const p = useLocalSearchParams<{
    novel: string;
    season: string;
    chapter: string;
    block?: string;
  }>();
  const { data, loading } = usePreviewPayload(p.novel, p.season, p.chapter, p.block);
  const frame = useRef<PreviewFrameHandle>(null);
  const [tier, setTier] = useState<PreviewTier>('auto');
  const [session, setSession] = useState(0);
  const [status, setStatus] = useState<Status>('connecting');
  const [detail, setDetail] = useState('');
  const payload = data?.ok ? data.payload : null;

  const send = useCallback(
    (t: PreviewTier) => payload && frame.current?.send(payload.build(t)),
    [payload],
  );

  useEffect(() => {
    setStatus('connecting');
    const timer = setTimeout(() => {
      setStatus((s) => (s === 'connecting' ? 'unreachable' : s));
      setDetail((d) => d || 'No answer from the reader preview.');
    }, READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [session, payload?.url]);

  const onMessage = (msg: ReaderMessage): void => {
    if (msg.type === 'kn-preview-ready') send(tier);
    else if (msg.type === 'kn-preview-rendered') setStatus('live');
    else {
      setStatus('rejected');
      setDetail(msg.errors.slice(0, 3).join('\n'));
    }
  };

  const restart = (): void => {
    setDetail('');
    setSession((n) => n + 1);
  };

  const pickTier = (t: PreviewTier): void => {
    setTier(t);
    if (status === 'live') send(t);
  };

  const header = (
    <Stack.Screen
      options={{
        headerRight: () => <Button compact variant="ghost" label="Restart" onPress={restart} />,
      }}
    />
  );
  if (loading) return <View style={styles.screen}>{header}</View>;
  if (!data?.ok) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState title="Nothing to preview yet" body={data?.errors.join('\n')} />
      </View>
    );
  }
  const { url, readerUrl, fromLiveDraft } = data.payload;

  return (
    <View style={styles.screen} testID="preview-screen">
      {header}
      <View style={styles.toolbar}>
        <Row>
          {PREVIEW_TIERS.map((t) => (
            <Chip key={t} label={TIER_LABEL[t]} selected={t === tier} onPress={() => pickTier(t)} />
          ))}
        </Row>
        <Text style={styles.note}>
          {status === 'live'
            ? '● Live'
            : status === 'connecting'
              ? '○ Connecting…'
              : '⚠︎ Not connected'}
          {fromLiveDraft ? ' · showing your unsaved draft' : ' · showing the saved chapter'}
        </Text>
      </View>
      {status === 'unreachable' || status === 'rejected' || !url ? (
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.bannerTitle}>
            {!url
              ? 'The reader URL is not valid'
              : status === 'rejected'
                ? 'The reader rejected this draft'
                : 'Reader preview unreachable'}
          </Text>
          <Text style={styles.bannerBody}>
            {status === 'rejected'
              ? detail
              : `Tried ${readerUrl}. Start the reader (pnpm dev) or point the writer at a reachable reader URL. ${detail}`}
          </Text>
          <Row>
            <Button compact label="Retry" onPress={restart} />
            <Button
              compact
              variant="ghost"
              label="Change reader URL"
              onPress={() => router.push(routes.appSettings)}
            />
          </Row>
        </View>
      ) : null}
      {url ? (
        <PreviewFrame
          key={`${session}:${url}`}
          ref={frame}
          url={url}
          onMessage={onMessage}
          onLoadError={(d) => {
            setDetail(d);
            setStatus('unreachable');
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  toolbar: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    gap: space.sm,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  note: { color: colors.muted, fontSize: 12 },
  banner: {
    margin: space.lg,
    padding: space.lg,
    gap: space.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.warn,
    backgroundColor: colors.surface,
  },
  bannerTitle: { color: colors.warn, fontSize: 15, fontWeight: '700' },
  bannerBody: { color: colors.fg, fontSize: 13, lineHeight: 19 },
});
