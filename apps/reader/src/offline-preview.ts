// Entry for the writer's built-in offline preview (scripts/build-preview-bundle.mjs). It is
// bundled into one self-contained HTML file, so it boots straight into `?preview=1` mode even
// when loaded from an iframe `srcdoc` or a WebView `html` source with no real query string.
import './styles.css';
import { startApp } from './app.ts';
import { applyPrefs } from './prefs.ts';

declare global {
  interface Window {
    __KN_OFFLINE_PREVIEW__?: boolean;
  }
}

window.__KN_OFFLINE_PREVIEW__ = true;
applyPrefs();
startApp();
