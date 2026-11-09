import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the offline service worker in production builds. `autoUpdate` reloads into a new
 * version as soon as it's installed; once real stories exist (Phase 1) this should wait for a safe
 * moment, such as a save point, instead.
 */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  registerSW({ immediate: true });
}
