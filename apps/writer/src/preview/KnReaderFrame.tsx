// Android: the split-chunk offline reader inside our own `KnReaderWebView` (OVERHAUL-03 native
// view, WebViewAssetLoader at https://appassets.androidplatform.net/reader/). Host → reader goes
// through the `postMessage` view command (→ `window.__knReceive`); reader → host arrives as
// `onKnMessage`. Renderer death and main-frame load errors arrive on the same channel as
// `kn-native-*` events, so a crash remounts the view instead of taking the app down.
import { useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import {
  findNodeHandle,
  requireNativeComponent,
  StyleSheet,
  UIManager,
  View,
  type HostComponent,
  type NativeSyntheticEvent,
  type ViewProps,
} from 'react-native';
import { ActionButton } from '../ui/ActionButton.tsx';
import { EmptyState } from '../ui/Page.tsx';
import { useTheme } from '../ui/theme.tsx';
import type { PreviewFrameProps } from './frame-types.ts';
import { parseNativeEvent, parseReaderMessage } from './protocol.ts';
import {
  initialRecovery,
  manualReload,
  recordRendererGone,
  recoveryLog,
  REMOUNT_DELAY_MS,
} from './recovery.ts';

interface KnReaderNativeProps extends ViewProps {
  /** Path under /reader/ (default `index.html?preview=1`). */
  sourcePath: string;
  onKnMessage: (e: NativeSyntheticEvent<{ data: string }>) => void;
}

let native: HostComponent<KnReaderNativeProps> | null = null;
const KnReaderWebView = (): HostComponent<KnReaderNativeProps> =>
  (native ??= requireNativeComponent<KnReaderNativeProps>('KnReaderWebView'));

/** The reader entry the native view loads (Record Mode is toggled live by a `record` message). */
export const KN_READER_PATH = 'index.html?preview=1';

type Props = Omit<PreviewFrameProps, 'html' | 'url'>;

export function KnReaderFrame({ onMessage, onLoadError, ref }: Props): ReactNode {
  const { colors } = useTheme();
  const view = useRef<View>(null);
  const [recovery, setRecovery] = useState(initialRecovery);
  const [mounted, setMounted] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useImperativeHandle(ref, () => ({
    send(message) {
      const tag = findNodeHandle(view.current);
      if (tag == null) return;
      // Integer id from getCommandsMap when the interop layer exposes it, else the string name
      // (Fabric interop); KnReaderWebViewManager accepts both.
      const cfg = UIManager.getViewManagerConfig('KnReaderWebView') as
        { Commands?: Record<string, number> } | undefined;
      const cmd = cfg?.Commands?.postMessage ?? 'postMessage';
      UIManager.dispatchViewManagerCommand(tag, cmd as number, [JSON.stringify(message)]);
    },
    // No v2 engine reads native shakes (only the retired v1 dice did); nothing to forward.
    triggerShake() {},
  }));

  const onRendererGone = (didCrash: boolean): void => {
    const { state, action } = recordRendererGone(recovery, Date.now());
    console.warn(recoveryLog(didCrash, action, state));
    setMounted(false);
    setRecovery(state);
    if (timer.current) clearTimeout(timer.current);
    if (action === 'remount') timer.current = setTimeout(() => setMounted(true), REMOUNT_DELAY_MS);
  };

  if (recovery.gaveUp) {
    return (
      <View style={[styles.web, { backgroundColor: colors.canvas }]} testID="preview-crashed">
        <EmptyState
          icon="alert-circle"
          title="The preview stopped"
          body="The phone closed the reader to save memory. Your draft is safe."
          action={
            <ActionButton
              label="Reload preview"
              testID="preview-reload"
              onPress={() => {
                setRecovery(manualReload);
                setMounted(true);
              }}
            />
          }
        />
      </View>
    );
  }
  if (!mounted) return <View style={[styles.web, { backgroundColor: colors.canvas }]} />;
  const Native = KnReaderWebView();
  return (
    <Native
      key={recovery.generation}
      ref={view as never}
      sourcePath={KN_READER_PATH}
      style={[styles.web, { backgroundColor: colors.canvas }]}
      onKnMessage={(e) => {
        const raw = e.nativeEvent.data;
        const ev = parseNativeEvent(raw);
        if (ev?.type === 'kn-native-render-gone') return onRendererGone(ev.didCrash);
        if (ev?.type === 'kn-native-load-error') return onLoadError(ev.description);
        const msg = parseReaderMessage(raw);
        if (msg) onMessage(msg);
      }}
    />
  );
}

const styles = StyleSheet.create({ web: { flex: 1 } });
