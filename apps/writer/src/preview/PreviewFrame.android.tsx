// Android Live Preview transport switch (OVERHAUL-04A). The built-in offline reader runs as split
// Vite chunks inside KnReaderWebView (WebViewAssetLoader, https://appassets.androidplatform.net);
// a custom reader URL keeps using react-native-webview. Emergency rollback: set the flag to false
// and Android falls back to the monolithic `reader-preview.html` in react-native-webview.
import type { ReactNode } from 'react';
import type { PreviewFrameProps } from './frame-types.ts';
import { KnReaderFrame } from './KnReaderFrame.tsx';
import { PreviewFrame as RnWebViewFrame } from './PreviewFrame.tsx';

export const KN_ASSET_WEBVIEW_ENABLED = true;

export function PreviewFrame(props: PreviewFrameProps): ReactNode {
  const { onMessage, onLoadError, ref } = props;
  if (KN_ASSET_WEBVIEW_ENABLED && props.html) {
    return <KnReaderFrame onMessage={onMessage} onLoadError={onLoadError} ref={ref} />;
  }
  return <RnWebViewFrame {...props} />;
}
