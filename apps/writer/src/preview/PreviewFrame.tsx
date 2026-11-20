// iOS / Android: the real reader inside react-native-webview.
import { useImperativeHandle, useRef, type ComponentType, type ReactNode, type Ref } from 'react';
import { StyleSheet } from 'react-native';
import { WebView as WebViewClass, type WebViewProps } from 'react-native-webview';
import { useTheme } from '../ui/theme.tsx';
import type { PreviewFrameProps } from './frame-types.ts';
import { parseReaderMessage } from './protocol.ts';

// The package's class typings collapse to `never` props under React 19 types; re-type it plainly.
type WebViewHandle = Pick<WebViewClass, 'injectJavaScript'>;
const WebView = WebViewClass as unknown as ComponentType<
  WebViewProps & { ref?: Ref<WebViewHandle> }
>;

export function PreviewFrame({
  html,
  url,
  onMessage,
  onLoadError,
  ref,
}: PreviewFrameProps): ReactNode {
  const { colors } = useTheme();
  const web = useRef<WebViewHandle>(null);
  useImperativeHandle(ref, () => ({
    send(message) {
      // Dispatch a MessageEvent inside the page; JSON is embedded as a JS string literal.
      const payload = JSON.stringify(JSON.stringify(message));
      web.current?.injectJavaScript(
        `window.dispatchEvent(new MessageEvent('message', { data: ${payload} })); true;`,
      );
    },
  }));
  return (
    <WebView
      ref={web}
      source={
        html ? { html, baseUrl: 'https://preview.local/?preview=1' } : { uri: url ?? 'about:blank' }
      }
      style={[styles.web, { backgroundColor: colors.canvas }]}
      originWhitelist={['*']}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      onMessage={(e) => {
        const msg = parseReaderMessage(e.nativeEvent.data);
        if (msg) onMessage(msg);
      }}
      onError={(e) => onLoadError(e.nativeEvent.description || 'The reader could not be reached.')}
      onHttpError={(e) => onLoadError(`The reader answered HTTP ${e.nativeEvent.statusCode}.`)}
    />
  );
}

const styles = StyleSheet.create({ web: { flex: 1 } });
