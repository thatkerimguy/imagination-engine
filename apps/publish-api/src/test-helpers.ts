// Shared harness for the UGC tests.
import { createMemoryLimiter } from './rate-limit.ts';
import { createMemoryStore } from './store.ts';
import type { HandlerConfig } from './config.ts';
import { handleRequest } from './worker.ts';
import { book, chapter } from './test-fixtures.ts';

export const TOKEN = 'publish-token';
export const MOD = 'mod-token';
export const BASE = 'http://x.test';

export function setup(extra: Partial<HandlerConfig> = {}, clock?: () => number) {
  const store = createMemoryStore();
  const config: HandlerConfig = {
    store,
    token: TOKEN,
    moderationToken: MOD,
    limiter: createMemoryLimiter(clock),
    now: () => new Date('2026-01-02T03:04:05.678Z'),
    ...extra,
  };
  const call = (path: string, init: RequestInit = {}) =>
    handleRequest(new Request(BASE + path, init), config);
  const withToken = (token: string, method: string, path: string, body?: unknown) =>
    call(path, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const publish = (slug = 'my-novel', patch: Record<string, unknown> = {}) => {
    const b = book([chapter('c1', 'published')]);
    return withToken(TOKEN, 'PUT', `/api/novels/${slug}`, {
      ...b,
      novel: { ...b.novel, id: slug, ...patch },
    });
  };
  const report = (body: unknown, headers: Record<string, string> = {}) =>
    call('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  return { store, config, call, withToken, publish, report };
}
