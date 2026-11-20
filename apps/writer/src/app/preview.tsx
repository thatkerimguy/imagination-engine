// Live Preview: the real apps/reader in a WebView (iframe on web), fed the unsaved draft.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { PreviewFrame } from '../preview/PreviewFrame';
import type { PreviewFrameHandle } from '../preview/frame-types.ts';
import { PREVIEW_TIERS, type PreviewTier, type ReaderMessage } from '../preview/protocol.ts';
import { usePreviewPayload } from '../preview/use-preview-payload.ts';
import { routes } from '../routes.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Glyph } from '../ui/Glyph.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { EmptyState } from '../ui/Page.tsx';
import { SegmentControl, type SegmentOption } from '../ui/SegmentControl.tsx';
import { radius, space } from '../ui/tokens.ts';
import { Txt } from '../ui/Txt.tsx';
import { makeStyles, useTheme } from '../ui/theme.tsx';

type Status = 'connecting' | 'live' | 'unreachable' | 'rejected';
const READY_TIMEOUT_MS = 8000;
const TIER_LABEL: Record<PreviewTier, string> = {
  auto: 'Auto',
  high: 'High',
  lite: 'Lite',
  reduced: 'Reduced',
};
const TIER_SEGMENTS: readonly SegmentOption<PreviewTier>[] = PREVIEW_TIERS.map((t) => ({
  value: t,
  label: TIER_LABEL[t],
  testID: `preview-tier-${t}`,
}));

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.canvas },
  toolbar: { paddingHorizontal: space.gutter, paddingBottom: space.sm, gap: space.xs },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  banner: {
    marginHorizontal: space.gutter,
    marginBottom: space.sm,
    padding: space.md,
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: t.colors.dangerSoft,
  },
  bannerHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bannerTitle: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.xs },
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
  const { colors } = useTheme();
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
          <IconBtn
            icon="refresh-cw"
            accessibilityLabel="Restart preview"
            testID="preview-restart"
            onPress={restart}
          />
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
        <SegmentControl<PreviewTier>
          options={TIER_SEGMENTS}
          value={tier}
          onChange={pickTier}
          accessibilityLabel="Quality tier"
          testID="preview-tier"
        />
        <View style={styles.note}>
          <View
            style={[
              styles.dot,
              { backgroundColor: status === 'live' ? colors.success : colors.inkMuted },
            ]}
          />
          <Txt variant="caption" color="inkMuted">
            {status === 'live'
              ? fromLiveDraft
                ? 'Live draft'
                : 'Saved chapter'
              : status === 'connecting'
                ? 'Connecting…'
                : 'Not connected'}
          </Txt>
        </View>
      </View>
      {status === 'unreachable' || status === 'rejected' || !url ? (
        <View style={styles.banner} accessibilityRole="alert">
          <View style={styles.bannerHead}>
            <Glyph name="cloud-off" color="danger" />
            <Txt variant="bodyStrong" color="danger" style={styles.bannerTitle}>
              {!url
                ? 'The reader URL is not valid'
                : status === 'rejected'
                  ? 'The reader rejected this draft'
                  : 'Reader preview unreachable'}
            </Txt>
          </View>
          <Txt variant="meta" color="ink">
            {status === 'rejected'
              ? detail
              : `Tried ${readerUrl}. Start the reader (pnpm dev) or point the writer at a reachable reader URL. ${detail}`}
          </Txt>
          <View style={styles.actions}>
            <ActionButton variant="secondary" label="Retry" onPress={restart} />
            <ActionButton
              variant="ghost"
              label="Change reader URL"
              onPress={() => router.push(routes.appSettings)}
            />
          </View>
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
