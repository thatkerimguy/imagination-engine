import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the offline service worker in production builds. `autoUpdate` reloads into a new
 * version once it's installed; when the Studio holds unsaved work (Phase 2) this must wait until the
 * project is saved.
 */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  registerSW({ immediate: true });
}
