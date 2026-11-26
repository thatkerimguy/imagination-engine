// App-wide crash reporter: the local ring buffer + the (opt-in) Sentry adapter, plus the root hook
// that applies the preference after the first frame and tracks parameterised route segments.
import Constants from 'expo-constants';
import { useSegments } from 'expo-router';
import { useEffect } from 'react';
import { loadSettings } from '../settings/app-settings.ts';
import { useRepository } from '../store/context.tsx';
import { runAfterInteractions } from '../ui/after-interactions.ts';
import { createCrashReporter } from './crash-reporter.ts';
import { sentryAdapter } from './sentry-adapter.ts';

export const crashReporter = createCrashReporter(sentryAdapter);

/** Empty in local builds; set at build time for release builds that opt in to a DSN. */
export const SENTRY_DSN: string = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';

interface GlobalErrorUtils {
  getGlobalHandler(): (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void;
}

let ringInstalled = false;

/** Records uncaught JS errors in the local ring (always local-only), chaining the old handler. */
function installRing(): void {
  const utils = (globalThis as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;
  if (ringInstalled || !utils) return;
  ringInstalled = true;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    crashReporter.ring.record(error);
    previous(error, isFatal);
  });
}

/** Turns remote reporting on or off. Never initialises without opt-in AND a DSN. */
export async function applyCrashReporting(enabled: boolean): Promise<boolean> {
  if (enabled !== true || !SENTRY_DSN) {
    if (crashReporter.active) await crashReporter.disable();
    return false;
  }
  if (crashReporter.active) return true;
  return crashReporter.init({
    dsn: SENTRY_DSN,
    release: `kinetic-writer@${APP_VERSION}`,
    environment: __DEV__ ? 'development' : 'production',
  });
}

/** Root-layout hook: deferred init past the first frame + `useSegments()` route tracking. */
export function useCrashReporting(): void {
  const repo = useRepository();
  const segments = useSegments();
  useEffect(() => {
    installRing();
    const task = runAfterInteractions(() => {
      void loadSettings(repo)
        .then((s) => applyCrashReporting(s.crashReportingEnabled))
        .catch(() => undefined);
    });
    return () => task.cancel();
  }, [repo]);
  const route = segments.join('/');
  useEffect(() => {
    crashReporter.setRouteSegments(route ? route.split('/') : []);
  }, [route]);
}
