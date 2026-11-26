// Zero-PII scrubbing for crash reports. Pure: works on a structural event shape, so it is
// testable without the Sentry SDK. Strategy is allow-list, not deny-list — the scrubbed event is
// rebuilt from scratch with only: error type, sanitised message, stack frames (file basename,
// function, line, column), app / OS version and the parameterised route. Everything else —
// user, request, extra, breadcrumbs, device, screenshots, view hierarchy, tags — is dropped.

export interface ScrubFrame {
  filename?: string;
  abs_path?: string;
  function?: string;
  module?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
  [k: string]: unknown;
}

export interface ScrubException {
  type?: string;
  value?: string;
  stacktrace?: { frames?: ScrubFrame[] };
  mechanism?: { type?: string; handled?: boolean; [k: string]: unknown };
  [k: string]: unknown;
}

export interface ScrubBreadcrumb {
  category?: string;
  message?: string;
  type?: string;
  level?: string;
  timestamp?: number;
  data?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface ScrubEvent {
  event_id?: string;
  timestamp?: number;
  platform?: string;
  level?: string;
  release?: string;
  dist?: string;
  environment?: string;
  exception?: { values?: ScrubException[] };
  breadcrumbs?: ScrubBreadcrumb[];
  contexts?: Record<string, Record<string, unknown> | undefined>;
  sdk?: unknown;
  debug_meta?: unknown;
  [k: string]: unknown;
}

/** The only breadcrumb category ever sent: our own parameterised route changes. */
export const ROUTE_CATEGORY = 'kn.route';
const MAX_VALUE = 160;
const MAX_FRAMES = 60;

const REDACTIONS: readonly [RegExp, string][] = [
  [/bearer\s+[\w.~+/=-]+/gi, 'Bearer [token]'],
  [/\b(?:token|secret|key|auth|password)\s*[:=]\s*\S+/gi, '[token]'],
  [/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '[url]'],
  [/(?:[A-Za-z]:\\|\/(?:data|storage|sdcard|Users|home|var|private)\/)\S*/g, '[path]'],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]'],
  [/“[^”]*”|"[^"]*"|'[^']*'|‘[^’]*’|«[^»]*»/g, '[text]'],
  [/\b[A-Za-z0-9_-]{24,}\b/g, '[id]'],
];

/** Strips prose, titles, quotes, paths, URLs, emails and tokens from an error message. */
export function scrubText(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  let out = value;
  for (const [re, sub] of REDACTIONS) out = out.replace(re, sub);
  out = out.replace(/\s+/g, ' ').trim();
  return out.length > MAX_VALUE ? `${out.slice(0, MAX_VALUE)}…` : out;
}

/** Bundle URLs (`app:///index.android.bundle`) stay; anything else becomes its basename. */
export function scrubFilename(name: string | undefined): string | undefined {
  if (typeof name !== 'string' || !name) return undefined;
  if (/^app:\/\/\/[\w.-]+$/.test(name)) return name;
  const clean = name.split(/[?#]/)[0] ?? '';
  const base = clean.slice(Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\')) + 1);
  return /^[\w.-]{1,120}$/.test(base) ? base : '[file]';
}

const IDENT = /^[\w$.<>@/ -]{1,120}$/;
const ident = (v: unknown): string | undefined =>
  typeof v === 'string' && IDENT.test(v) ? v : undefined;
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

function scrubFrame(f: ScrubFrame): ScrubFrame {
  const out: ScrubFrame = {};
  const filename = scrubFilename(f.filename ?? f.abs_path);
  if (filename) out.filename = filename;
  const fn = ident(f.function);
  if (fn) out.function = fn;
  const line = num(f.lineno);
  if (line !== undefined) out.lineno = line;
  const col = num(f.colno);
  if (col !== undefined) out.colno = col;
  if (typeof f.in_app === 'boolean') out.in_app = f.in_app;
  return out;
}

function scrubException(e: ScrubException): ScrubException {
  const out: ScrubException = { type: ident(e.type) ?? 'Error' };
  const value = scrubText(e.value);
  if (value) out.value = value;
  const frames = e.stacktrace?.frames;
  if (Array.isArray(frames)) out.stacktrace = { frames: frames.slice(-MAX_FRAMES).map(scrubFrame) };
  if (e.mechanism)
    out.mechanism = {
      type: ident(e.mechanism.type) ?? 'generic',
      ...(typeof e.mechanism.handled === 'boolean' ? { handled: e.mechanism.handled } : {}),
    };
  return out;
}

const SEGMENT = /^(\[[A-Za-z]+\]|\([a-z-]+\)|[a-z0-9+_-]{1,40})$/;

/** A parameterised Expo Router route (`novel/[novelId]/chapter/[seasonId]/[chapterId]`). */
export function routeFromSegments(segments: readonly string[]): string {
  const parts = segments.map((s) => (SEGMENT.test(s) ? s : '[?]'));
  return parts.length ? parts.join('/') : 'index';
}

/** Keeps only our own route breadcrumbs, rebuilt with a sanitised route. Else null. */
export function scrubBreadcrumb(b: ScrubBreadcrumb): ScrubBreadcrumb | null {
  if (b.category !== ROUTE_CATEGORY || typeof b.message !== 'string') return null;
  const route = routeFromSegments(b.message.split('/'));
  return {
    category: ROUTE_CATEGORY,
    type: 'navigation',
    level: 'info',
    message: route,
    ...(num(b.timestamp) !== undefined ? { timestamp: b.timestamp } : {}),
  };
}

const pick = (
  ctx: Record<string, unknown> | undefined,
  fields: readonly string[],
): Record<string, string> | undefined => {
  if (!ctx) return undefined;
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = ctx[f];
    if (typeof v === 'string' && /^[\w .()+-]{1,40}$/.test(v)) out[f] = v;
  }
  return Object.keys(out).length ? out : undefined;
};

/** Rebuilds an event from its allow-listed parts. `route` is the current parameterised route. */
export function scrubEvent(event: ScrubEvent, route?: string): ScrubEvent {
  const out: ScrubEvent = {};
  for (const k of ['event_id', 'platform', 'level', 'release', 'dist', 'environment'] as const) {
    const v = ident(event[k]);
    if (v) out[k] = v;
  }
  if (num(event.timestamp) !== undefined) out.timestamp = event.timestamp;
  const values = event.exception?.values;
  if (Array.isArray(values)) out.exception = { values: values.map(scrubException) };
  const crumbs = (event.breadcrumbs ?? []).map(scrubBreadcrumb).filter((b) => b !== null);
  if (crumbs.length) out.breadcrumbs = crumbs.slice(-20);
  const os = pick(event.contexts?.os, ['name', 'version']);
  const app = pick(event.contexts?.app, ['app_version', 'app_build']);
  if (os || app) out.contexts = { ...(os ? { os } : {}), ...(app ? { app } : {}) };
  if (route) out.tags = { route: routeFromSegments(route.split('/')) };
  if (event.sdk) out.sdk = event.sdk;
  if (event.debug_meta) out.debug_meta = event.debug_meta;
  return out;
}
