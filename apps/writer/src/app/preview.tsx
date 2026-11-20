// Live Preview: the real apps/reader in a WebView (iframe on web), fed the unsaved draft.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { PreviewFrame } from '../preview/PreviewFrame';
import type { PreviewFrameHandle } from '../preview/frame-types.ts';
import { PREVIEW_TIERS, type PreviewTier, type ReaderMessage } from '../preview/protocol.ts';
import { usePreviewPayload } from '../preview/use-preview-payload.ts';
import { routes } from '../routes.ts';
import { AppText } from '../ui/AppText.tsx';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../ui/Icon.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import { EmptyState, Row } from '../ui/layout.tsx';
import { shape, space } from '../ui/m3-tokens.ts';
import { SegmentedButtons, type Segment } from '../ui/SegmentedButtons.tsx';
import { makeStyles, useTheme } from '../ui/theme.tsx';

type Status = 'connecting' | 'live' | 'unreachable' | 'rejected';
const READY_TIMEOUT_MS = 8000;
const TIER_LABEL: Record<PreviewTier, string> = {
  auto: 'Auto',
  high: 'High',
  lite: 'Lite',
  reduced: 'Reduced',
};
const TIER_SEGMENTS: readonly Segment<PreviewTier>[] = PREVIEW_TIERS.map((t) => ({
  value: t,
  label: TIER_LABEL[t],
}));

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.m3.surface },
  toolbar: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    gap: space.sm,
    borderBottomWidth: 1,
    borderColor: t.m3.outlineVariant,
  },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  headerRight: { paddingRight: space.xs },
  banner: {
    margin: space.lg,
    padding: space.lg,
    gap: space.sm,
    borderRadius: shape.large,
    backgroundColor: t.m3.errorContainer,
  },
  bannerHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bannerTitle: { flex: 1 },
}));

export default function PreviewScreen(): ReactNode {
  const p = useLocalSearchParams<{
    novel: string;
    season: string;
    chapter: string;
    block?: string;
  }>();
  const { data, loading } = usePreviewPayload(p.novel, p.season, p.chapter, p.block);
  const styles = useStyles();
  const { m3 } = useTheme();
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
        headerRight: () => (
          <View style={styles.headerRight}>
            <IconButton
              icon="refresh"
              accessibilityLabel="Restart preview"
              testID="preview-restart"
              onPress={restart}
            />
          </View>
        ),
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
        <SegmentedButtons
          segments={TIER_SEGMENTS}
          value={tier}
          onChange={pickTier}
          accessibilityLabel="Quality tier"
          testID="preview-tier"
        />
        <View style={styles.note}>
          <View
            style={[
              styles.dot,
              { backgroundColor: status === 'live' ? m3.primary : m3.outline },
            ]}
          />
          <AppText variant="labelSmall" color="onSurfaceVariant">
            {status === 'live' ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Not connected'}
            {fromLiveDraft ? ' · showing your unsaved draft' : ' · showing the saved chapter'}
          </AppText>
        </View>
      </View>
      {status === 'unreachable' || status === 'rejected' || !url ? (
        <View style={styles.banner} accessibilityRole="alert">
          <View style={styles.bannerHead}>
            <Icon name="cloud-off" color="onErrorContainer" />
            <AppText variant="titleMedium" color="onErrorContainer" style={styles.bannerTitle}>
              {!url
                ? 'The reader URL is not valid'
                : status === 'rejected'
                  ? 'The reader rejected this draft'
                  : 'Reader preview unreachable'}
            </AppText>
          </View>
          <AppText variant="bodyMedium" color="onErrorContainer">
            {status === 'rejected'
              ? detail
              : `Tried ${readerUrl}. Start the reader (pnpm dev) or point the writer at a reachable reader URL. ${detail}`}
          </AppText>
          <Row>
            <Button variant="tonal" label="Retry" onPress={restart} />
            <Button
              variant="text"
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
