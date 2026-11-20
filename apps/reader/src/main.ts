import './styles.css';
import { startApp } from './app.ts';
import { applyPrefs } from './prefs.ts';

applyPrefs();
startApp();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // The PWA worker is a nicety; a failed registration must never break reading.
  void import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => undefined);
}
