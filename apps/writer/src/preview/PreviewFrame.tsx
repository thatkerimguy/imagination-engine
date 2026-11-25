// iOS / Android: the real reader inside react-native-webview.
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type Ref,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView as WebViewClass, type WebViewProps } from 'react-native-webview';
import { ActionButton } from '../ui/ActionButton.tsx';
import { EmptyState } from '../ui/Page.tsx';
import { useTheme } from '../ui/theme.tsx';
import type { PreviewFrameProps } from './frame-types.ts';
import { parseReaderMessage } from './protocol.ts';
import {
  initialRecovery,
  manualReload,
  recordRendererGone,
  recoveryLog,
  REMOUNT_DELAY_MS,
} from './recovery.ts';

// The package's class typings collapse to `never` props under React 19 types; re-type it plainly.
type WebViewHandle = Pick<WebViewClass, 'injectJavaScript'>;
const WebView = WebViewClass as unknown as ComponentType<
  WebViewProps & { ref?: Ref<WebViewHandle> }
>;

/** Tells the reader that shakes arrive from the writer's accelerometer (see use-native-shake). */
const NATIVE_SHAKE_FLAG = 'window.__KN_NATIVE_SHAKE__ = true; true;';
const SHAKE_JS = "window.dispatchEvent(new Event('kn-native-shake')); true;";
/** Only web content: the bundled reader (https://preview.local) or a dev/custom reader URL. */
const ORIGINS = ['https://*', 'http://*', 'about:*'];

export function PreviewFrame({
  html,
  url,
  onMessage,
  onLoadError,
  ref,
}: PreviewFrameProps): ReactNode {
  const { colors } = useTheme();
  const web = useRef<WebViewHandle>(null);
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
      // Dispatch a MessageEvent inside the page; JSON is embedded as a JS string literal.
      const payload = JSON.stringify(JSON.stringify(message));
      web.current?.injectJavaScript(
        `window.dispatchEvent(new MessageEvent('message', { data: ${payload} })); true;`,
      );
    },
    triggerShake() {
      web.current?.injectJavaScript(SHAKE_JS);
    },
  }));

  // The renderer died (LMK, WebView update, crash): drop the dead view, then remount it after a
  // tick. The new page posts `kn-preview-ready`, and the screen replays chapter, tier,
  // reduced-motion, lifecycle and reading position from there.
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
  return (
    <WebView
      key={recovery.generation}
      ref={web}
      source={
        html ? { html, baseUrl: 'https://preview.local/?preview=1' } : { uri: url ?? 'about:blank' }
      }
      style={[styles.web, { backgroundColor: colors.canvas }]}
      originWhitelist={ORIGINS}
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      setSupportMultipleWindows={false}
      injectedJavaScriptBeforeContentLoaded={NATIVE_SHAKE_FLAG}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      onMessage={(e) => {
        const msg = parseReaderMessage(e.nativeEvent.data);
        if (msg) onMessage(msg);
      }}
      onRenderProcessGone={(e) => onRendererGone(e.nativeEvent.didCrash)}
      onContentProcessDidTerminate={() => onRendererGone(true)}
      onError={(e) => onLoadError(e.nativeEvent.description || 'The reader could not be reached.')}
      onHttpError={(e) => onLoadError(`The reader answered HTTP ${e.nativeEvent.statusCode}.`)}
    />
  );
}

const styles = StyleSheet.create({ web: { flex: 1 } });
