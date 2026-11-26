// CrashReporterPort: the only crash-reporting surface the app talks to. Off by default; turned on
// only by the opt-in "Anonymous crash reports" toggle AND a configured EXPO_PUBLIC_SENTRY_DSN, and
// only after the first frame. A local in-memory ring buffer always keeps the last few scrubbed
// error types (never leaves the device) for the redacted Diagnostic Report.
import { routeFromSegments, scrubText } from './scrub-event.ts';

export interface CrashReporterInit {
  dsn: string;
  release?: string;
  environment?: string;
}

export interface CrashReporterPort {
  /** Starts remote reporting. Resolves false when unavailable (no DSN, web, SDK failure). */
  init(opts: CrashReporterInit): Promise<boolean>;
  /** Stops remote reporting immediately (the toggle was switched off). */
  disable(): Promise<void>;
  captureException(error: unknown): void;
  /** Parameterised Expo Router segments only (`useSegments()`), never a concrete pathname. */
  setRouteSegments(segments: readonly string[]): void;
  readonly active: boolean;
}

export interface LocalCrash {
  type: string;
  message?: string;
  route: string;
  at: number;
}

export const RING_SIZE = 20;

/** Local-only ring buffer of scrubbed errors. Pure, used as the fallback adapter too. */
export function createCrashRing(size = RING_SIZE, now: () => number = Date.now) {
  const items: LocalCrash[] = [];
  let route = 'index';
  return {
    record(error: unknown): void {
      const e = error instanceof Error ? error : new Error(String(error));
      const type = /^[\w$.]{1,60}$/.test(e.name) ? e.name : 'Error';
      const message = scrubText(e.message);
      items.push({ type, ...(message ? { message } : {}), route, at: now() });
      if (items.length > size) items.splice(0, items.length - size);
    },
    setRoute(segments: readonly string[]): void {
      route = routeFromSegments(segments);
    },
    get route(): string {
      return route;
    },
    list: (): readonly LocalCrash[] => [...items],
    clear: (): void => void items.splice(0),
  };
}

export type CrashRing = ReturnType<typeof createCrashRing>;

/** Composes the local ring with an optional remote adapter; the remote only runs while active. */
export function createCrashReporter(
  remote: CrashReporterPort | undefined,
  ring: CrashRing = createCrashRing(),
): CrashReporterPort & { ring: CrashRing } {
  return {
    ring,
    get active() {
      return remote?.active ?? false;
    },
    async init(opts) {
      if (!remote || !opts.dsn.trim()) return false;
      try {
        return await remote.init(opts);
      } catch {
        return false;
      }
    },
    async disable() {
      await remote?.disable();
    },
    captureException(error) {
      ring.record(error);
      if (remote?.active) remote.captureException(error);
    },
    setRouteSegments(segments) {
      ring.setRoute(segments);
      remote?.setRouteSegments(segments);
    },
  };
}
