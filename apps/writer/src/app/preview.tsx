// Live Preview: the real apps/reader in a WebView (iframe on web), fed the unsaved draft.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PreviewBanner } from '../preview/PreviewBanner.tsx';
import { PreviewFrame } from '../preview/PreviewFrame';
import type { PreviewFrameHandle } from '../preview/frame-types.ts';
import {
  a11yMessage,
  lifecycleMessage,
  PREVIEW_TIERS,
  type PreviewTier,
  type ReaderMessage,
} from '../preview/protocol.ts';
import { useForeground, useReduceMotion } from '../preview/use-host-signals.ts';
import { useNativeShake } from '../preview/use-native-shake.ts';
import { usePreviewPayload } from '../preview/use-preview-payload.ts';
import { useRepository } from '../store/context.tsx';
import { saveSettings } from '../settings/app-settings.ts';
import { routes } from '../routes.ts';
import { IconBtn } from '../ui/IconBtn.tsx';
import { EmptyState } from '../ui/Page.tsx';
import { SegmentControl, type SegmentOption } from '../ui/SegmentControl.tsx';
import { THEATER_BG, THEATER_THEME } from '../ui/theater.ts';
import { space } from '../ui/tokens.ts';
import { Txt } from '../ui/Txt.tsx';
import { makeStyles, ThemeOverride, useTheme } from '../ui/theme.tsx';

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

// Rendered under THEATER_THEME, so `t` is the fixed dark surround on Day themes too.
const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.canvas },
  toolbar: {
    paddingHorizontal: space.gutter,
    paddingBottom: space.sm,
    gap: space.xs,
    borderBottomWidth: 1,
    borderColor: t.colors.hairline,
  },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
}));

/** The dark theater surround applies to the header, tier bar and status line alike. */
export default function PreviewScreen(): ReactNode {
  return (
    <ThemeOverride theme={THEATER_THEME}>
      <StatusBar style="light" />
      <PreviewBody />
    </ThemeOverride>
  );
}

function PreviewBody(): ReactNode {
  const p = useLocalSearchParams<{
    novel: string;
    season: string;
    chapter: string;
    block?: string;
  }>();
  const repo = useRepository();
  const { data, loading, reload } = usePreviewPayload(p.novel, p.season, p.chapter, p.block);
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const frame = useRef<PreviewFrameHandle>(null);
  const [tier, setTier] = useState<PreviewTier>('auto');
  const [session, setSession] = useState(0);
  const [status, setStatus] = useState<Status>('connecting');
  const [detail, setDetail] = useState('');
  const payload = data?.ok ? data.payload : null;
  const foreground = useForeground();
  const reducedMotion = useReduceMotion();
  /** Last block the reader reported; replayed after a tier switch or a renderer remount. */
  const position = useRef<string | undefined>(undefined);
  useNativeShake(status === 'live', () => frame.current?.triggerShake());

  const send = useCallback(
    (t: PreviewTier) => payload && frame.current?.send(payload.build(t, position.current)),
    [payload],
  );

  // Background/blur pauses reader audio, RAF loops and sensors; OS reduce-motion forces 'reduced'.
  useEffect(() => frame.current?.send(lifecycleMessage(foreground)), [foreground]);
  useEffect(() => frame.current?.send(a11yMessage(reducedMotion)), [reducedMotion]);

  useEffect(() => {
    setStatus('connecting');
    const timer = setTimeout(() => {
      setStatus((s) => (s === 'connecting' ? 'unreachable' : s));
      setDetail((d) => d || 'No answer from the reader preview.');
    }, READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [session, payload?.url]);

  const onMessage = (msg: ReaderMessage): void => {
    if (msg.type === 'kn-preview-ready') {
      // Also the replay path after a renderer crash remount (see PreviewFrame / recovery.ts).
      frame.current?.send(a11yMessage(reducedMotion));
      frame.current?.send(lifecycleMessage(foreground));
      send(tier);
    } else if (msg.type === 'kn-preview-position') position.current = msg.blockId;
    else if (msg.type === 'kn-preview-rendered') setStatus('live');
    else {
      setStatus('rejected');
      setDetail(msg.errors.slice(0, 3).join('\n'));
    }
  };

  const restart = (): void => {
    position.current = undefined;
    setDetail('');
    setSession((n) => n + 1);
    reload();
  };

  const pickTier = (t: PreviewTier): void => {
    setTier(t);
    if (status === 'live') send(t);
  };

  const header = (
    <Stack.Screen
      options={{
        headerStyle: { backgroundColor: THEATER_BG },
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
  const { url, html, htmlError, readerUrl, fromLiveDraft } = data.payload;
  const offline = data.payload.mode === 'offline';
  const switchOffline = async (): Promise<void> => {
    await saveSettings(repo, { previewMode: 'offline' });
    setDetail('');
    setSession((n) => n + 1);
    reload();
  };
  const openSettings = (): void => router.push(routes.appSettings);
  const problem = offline
    ? htmlError !== null || status === 'rejected' || status === 'unreachable'
    : !url || status === 'rejected' || status === 'unreachable';
  const banner = !problem
    ? null
    : status === 'rejected'
      ? { title: 'The reader rejected this draft', body: detail }
      : offline
        ? {
            title: 'The built-in reader could not start',
            body: `${htmlError ?? detail} Try again, or restart the app.`,
          }
        : {
            title: !url ? 'The reader URL is not valid' : 'Reader preview unreachable',
            body: `Tried ${readerUrl}. Start the reader (pnpm dev) or point the writer at a reachable reader URL. ${detail}`,
          };

  return (
    // Edge-to-edge: keep the reader WebView above the gesture / 3-button navigation bar.
    <View style={[styles.screen, { paddingBottom: insets.bottom }]} testID="preview-screen">
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
          <Txt variant="caption" color="inkMuted" testID="preview-mode-note">
            {status === 'live'
              ? `Live · ${offline ? 'Built-in offline reader' : 'Custom reader'} · ${
                  fromLiveDraft ? 'draft' : 'saved chapter'
                }`
              : status === 'connecting'
                ? 'Connecting…'
                : 'Not connected'}
          </Txt>
        </View>
      </View>
      {banner ? (
        <PreviewBanner
          title={banner.title}
          body={banner.body}
          onRetry={restart}
          {...(offline
            ? {}
            : { onSwitchOffline: () => void switchOffline(), onChangeUrl: openSettings })}
        />
      ) : null}
      {html || url ? (
        <PreviewFrame
          key={`${session}:${html ? 'offline' : url}`}
          ref={frame}
          {...(html ? { html } : url ? { url } : {})}
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
