// Native Sentry adapter behind CrashReporterPort. The SDK module is imported lazily on the first
// opt-in init (never before first frame, never when the toggle is off or the DSN is empty).
// Every auto-capture surface that could carry prose is off: no default PII, screenshots, view
// hierarchy, replay, tracing, console / network / UI breadcrumbs or native crash scope sync; every
// event and breadcrumb is rebuilt from an allow-list in scrub-event.ts.
import type * as SentryNs from '@sentry/react-native';
import type { CrashReporterPort } from './crash-reporter.ts';
import {
  ROUTE_CATEGORY,
  routeFromSegments,
  scrubBreadcrumb,
  scrubEvent,
  type ScrubBreadcrumb,
  type ScrubEvent,
} from './scrub-event.ts';

type SentryModule = typeof SentryNs;

/** Default integrations that observe UI, network, console or the device: never installed. */
const BLOCKED_INTEGRATIONS = new Set([
  'Breadcrumbs',
  'HttpClient',
  'Screenshot',
  'ViewHierarchy',
  'MobileReplay',
  'ReactNativeTracing',
  'ReactNavigation',
  'DeviceContext',
  'Spotlight',
  'ConsoleLogs',
  'AppStart',
  'NativeFrames',
  'StallTracking',
  'UserInteraction',
]);

let sentry: SentryModule | null = null;
let active = false;
let route = 'index';

export const sentryAdapter: CrashReporterPort | undefined = {
  get active() {
    return active;
  },
  async init({ dsn, release, environment }) {
    if (!dsn) return false;
    sentry ??= await import('@sentry/react-native');
    sentry.init({
      dsn,
      ...(release ? { release } : {}),
      ...(environment ? { environment } : {}),
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      attachThreads: false,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      tracesSampleRate: 0,
      enableAutoPerformanceTracing: false,
      enableAutoSessionTracking: false,
      enableCaptureFailedRequests: false,
      enableAppStartTracking: false,
      enableNativeFramesTracking: false,
      enableStallTracking: false,
      enableUserInteractionTracing: false,
      enableAutoBreadcrumbTracking: false,
      enableNetworkBreadcrumbs: false,
      enableActivityLifecycleBreadcrumbs: false,
      enableAppLifecycleBreadcrumbs: false,
      enableSystemEventBreadcrumbs: false,
      enableAppComponentBreadcrumbs: false,
      enableAutoConsoleLogs: false,
      // Native-only crash paths bypass JS beforeSend, so they stay off: every event is scrubbed.
      enableNativeCrashHandling: false,
      enableNdk: false,
      enableNdkScopeSync: false,
      enableTombstone: false,
      enableNativeNagger: false,
      sendClientReports: false,
      maxBreadcrumbs: 20,
      integrations: (defaults) => defaults.filter((i) => !BLOCKED_INTEGRATIONS.has(i.name)),
      beforeBreadcrumb: (b) => scrubBreadcrumb(b as ScrubBreadcrumb) as typeof b | null,
      beforeSend: (e) =>
        active
          ? ({
              ...scrubEvent(e as unknown as ScrubEvent, route),
              type: e.type,
            } as unknown as typeof e)
          : null,
    });
    active = true;
    return true;
  },
  async disable() {
    active = false;
    await sentry?.close().catch(() => undefined);
  },
  captureException(error) {
    if (active) sentry?.captureException(error);
  },
  setRouteSegments(segments) {
    const next = routeFromSegments(segments);
    if (next === route) return;
    route = next;
    if (active) sentry?.addBreadcrumb({ category: ROUTE_CATEGORY, message: next });
  },
};
