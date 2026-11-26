import { describe, expect, it } from 'vitest';
import { createCrashReporter, createCrashRing, type CrashReporterPort } from './crash-reporter.ts';
import {
  ROUTE_CATEGORY,
  routeFromSegments,
  scrubBreadcrumb,
  scrubEvent,
  scrubFilename,
  scrubText,
  type ScrubEvent,
} from './scrub-event.ts';

const PROSE = 'The rain over Neo-Kowloon tasted of copper';
const leaky: ScrubEvent = {
  event_id: 'abc123',
  platform: 'javascript',
  level: 'error',
  release: 'kinetic-writer@0.1.0',
  timestamp: 1,
  user: { id: 'u1', email: 'me@example.com', ip_address: '1.2.3.4' },
  request: { url: 'https://api.example.com/publish?token=SECRET' },
  extra: { chapterTitle: 'Snake Eyes', text: PROSE },
  tags: { novel: 'Chrome Tide' },
  contexts: {
    os: { name: 'Android', version: '15', kernel_version: 'x' },
    app: { app_version: '0.1.0', app_build: '1', device_app_hash: 'h' },
    device: { model: 'Pixel 9', name: "Author's phone" },
  },
  breadcrumbs: [
    { category: 'console', message: PROSE },
    { category: 'ui.click', message: 'Snake Eyes' },
    { category: 'xhr', data: { body: PROSE } },
    { category: ROUTE_CATEGORY, message: 'novel/[novelId]/chapter/[seasonId]/[chapterId]' },
  ],
  exception: {
    values: [
      {
        type: 'NotFoundError',
        value: `Chapter “Snake Eyes” not found at file:///data/user/0/dev.kinetic.writer/files/x.json with Bearer abc.def`,
        stacktrace: {
          frames: [
            {
              filename: '/data/user/0/dev.kinetic.writer/files/secret-novel.js',
              function: 'saveChapter',
              lineno: 10,
              colno: 4,
              in_app: true,
              vars: { text: PROSE },
              context_line: PROSE,
            },
            { filename: 'app:///index.android.bundle', function: 'render', lineno: 1 },
          ],
        },
        mechanism: { type: 'onerror', handled: false, data: { text: PROSE } },
      },
    ],
  },
};

describe('scrubEvent (zero-PII allow-list)', () => {
  const out = scrubEvent(leaky, 'novel/[novelId]/chapter/[seasonId]/[chapterId]');
  const json = JSON.stringify(out);

  it('drops user, request, extra, device, tags and non-route breadcrumbs', () => {
    expect(out.user).toBeUndefined();
    expect(out.request).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.contexts).toEqual({
      os: { name: 'Android', version: '15' },
      app: { app_version: '0.1.0', app_build: '1' },
    });
    expect(out.tags).toEqual({ route: 'novel/[novelId]/chapter/[seasonId]/[chapterId]' });
    expect(out.breadcrumbs).toHaveLength(1);
  });

  it('never contains prose, titles, paths, URLs, emails or tokens', () => {
    for (const leak of [
      PROSE,
      'Snake Eyes',
      'Chrome Tide',
      '/data/user',
      'https://',
      'abc.def',
      'example.com',
      'Pixel',
      'SECRET',
    ])
      expect(json).not.toContain(leak);
  });

  it('keeps error type, sanitised value and minimal frames', () => {
    const ex = out.exception?.values?.[0];
    expect(ex?.type).toBe('NotFoundError');
    expect(ex?.value).toBe('Chapter [text] not found at [url] with Bearer [token]');
    expect(ex?.stacktrace?.frames).toEqual([
      { filename: 'secret-novel.js', function: 'saveChapter', lineno: 10, colno: 4, in_app: true },
      { filename: 'app:///index.android.bundle', function: 'render', lineno: 1 },
    ]);
    expect(ex?.mechanism).toEqual({ type: 'onerror', handled: false });
  });
});

describe('scrub helpers', () => {
  it('redacts quoted text, emails, absolute paths and long ids', () => {
    expect(scrubText('Bad "My Secret Novel" for a@b.co in C:\\Users\\me\\x')).toBe(
      'Bad [text] for [email] in [path]',
    );
    expect(scrubText('id 01m8akgmamw9654y5p44p3hc1w gone')).toBe('id [id] gone');
    expect(scrubText('x'.repeat(400))?.length).toBeLessThanOrEqual(161);
  });

  it('keeps bundle URLs and reduces other files to safe basenames', () => {
    expect(scrubFilename('app:///index.android.bundle')).toBe('app:///index.android.bundle');
    expect(scrubFilename('C:\\Users\\me\\My Novel.js')).toBe('[file]');
    expect(scrubFilename('/a/b/c.js?x=1')).toBe('c.js');
  });

  it('parameterised routes only, unknown segments masked', () => {
    expect(routeFromSegments(['novel', '[novelId]', 'chapter', '[seasonId]', '[chapterId]'])).toBe(
      'novel/[novelId]/chapter/[seasonId]/[chapterId]',
    );
    expect(routeFromSegments(['folders', 'My Secret Folder'])).toBe('folders/[?]');
    expect(routeFromSegments([])).toBe('index');
  });

  it('beforeBreadcrumb keeps only route crumbs', () => {
    expect(scrubBreadcrumb({ category: 'console', message: PROSE })).toBeNull();
    expect(scrubBreadcrumb({ category: 'navigation', data: { to: '/novel/abc' } })).toBeNull();
    expect(scrubBreadcrumb({ category: ROUTE_CATEGORY, message: 'settings' })?.message).toBe(
      'settings',
    );
  });
});

describe('crash reporter port', () => {
  const fake = (): CrashReporterPort & { calls: string[] } => {
    const calls: string[] = [];
    let on = false;
    return {
      calls,
      get active() {
        return on;
      },
      init: async () => (on = true),
      disable: async () => void (on = false),
      captureException: () => void calls.push('capture'),
      setRouteSegments: (s) => void calls.push(`route:${s.join('/')}`),
    };
  };

  it('never inits without a DSN and only forwards while active', async () => {
    const remote = fake();
    const r = createCrashReporter(
      remote,
      createCrashRing(3, () => 7),
    );
    expect(await r.init({ dsn: ' ' })).toBe(false);
    r.captureException(new TypeError('boom "Snake Eyes"'));
    expect(remote.calls).toEqual([]);
    expect(await r.init({ dsn: 'https://k@o.ingest/1' })).toBe(true);
    r.captureException(new Error('x'));
    expect(remote.calls).toEqual(['capture']);
    await r.disable();
    r.captureException(new Error('y'));
    expect(remote.calls).toEqual(['capture']);
    expect(r.ring.list()[0]).toEqual({
      type: 'TypeError',
      message: 'boom [text]',
      route: 'index',
      at: 7,
    });
  });

  it('ring buffer is bounded and tracks the parameterised route', () => {
    const ring = createCrashRing(2);
    ring.setRoute(['trash']);
    for (let i = 0; i < 5; i++) ring.record(new Error(String(i)));
    expect(ring.list()).toHaveLength(2);
    expect(ring.list()[1]?.route).toBe('trash');
  });
});
