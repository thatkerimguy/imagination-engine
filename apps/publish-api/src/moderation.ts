// Moderation routes (bearer MODERATION_TOKEN, never PUBLISH_TOKEN): list reports, take down, clear.
import { extractBearer, tokenMatches } from './auth.ts';
import type { HandlerConfig } from './config.ts';
import { fail, isRecord, json, readCappedJson } from './http.ts';
import { unpublishNovel } from './publish.ts';
import { isSlugId } from './protocol.ts';
import { tombstoneKey } from './takedown.ts';

const PENDING = 'reports/pending/';
const RESOLVED = 'reports/resolved/';
const JSON_TYPE = 'application/json; charset=utf-8';

function authorize(request: Request, token: string | undefined): Response | null {
  if (!token) return fail('Moderation is not configured', 503);
  const provided = extractBearer(request);
  if (provided === null || !tokenMatches(provided, token)) {
    return fail('Missing or invalid token', 401);
  }
  return null;
}

async function listReports(config: HandlerConfig): Promise<Response> {
  const reports: unknown[] = [];
  for (const key of await config.store.list(PENDING)) {
    const obj = await config.store.get(key);
    if (!obj) continue;
    try {
      reports.push(JSON.parse(new TextDecoder().decode(obj.body)) as unknown);
    } catch {
      // skip unreadable records
    }
  }
  return json({ ok: true, reports });
}

async function resolveReport(config: HandlerConfig, reportId: string): Promise<void> {
  const key = (await config.store.list(PENDING)).find((k) => k.endsWith(`-${reportId}.json`));
  if (!key) return;
  const obj = await config.store.get(key);
  if (!obj) return;
  await config.store.put(RESOLVED + key.slice(PENDING.length), obj.body, JSON_TYPE);
  await config.store.delete(key);
}

async function takedown(request: Request, config: HandlerConfig): Promise<Response> {
  const body = await readCappedJson(request, 8 * 1024);
  if (body instanceof Response) return body;
  if (!isRecord(body)) return fail('Body must be an object', 400);
  const { novelSlug, reason, reportId } = body;
  if (!isSlugId(novelSlug)) return fail('Invalid novelSlug', 400);
  if (typeof reason !== 'string' || reason === '' || reason.length > 500) {
    return fail('reason must be 1-500 characters', 400);
  }
  if (
    reportId !== undefined &&
    (typeof reportId !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(reportId))
  ) {
    return fail('Invalid reportId', 400);
  }
  const now = (config.now ?? (() => new Date()))();
  const record = {
    novelSlug,
    reason,
    ...(reportId ? { reportId } : {}),
    takenDownAt: now.toISOString(),
  };
  await config.store.put(
    tombstoneKey(novelSlug),
    new TextEncoder().encode(JSON.stringify(record)),
    JSON_TYPE,
  );
  const { removedKeys } = await unpublishNovel(config.store, novelSlug);
  if (reportId) await resolveReport(config, reportId);
  return json({ ok: true, novelSlug, removedKeys });
}

export async function routeModeration(
  request: Request,
  pathname: string,
  config: HandlerConfig,
): Promise<Response | null> {
  if (!pathname.startsWith('/api/moderation/')) return null;
  const method = request.method.toUpperCase();
  const denied = authorize(request, config.moderationToken);
  if (denied) return denied;
  if (pathname === '/api/moderation/reports') {
    return method === 'GET' ? listReports(config) : fail('Method not allowed', 405);
  }
  if (pathname === '/api/moderation/takedown') {
    return method === 'POST' ? takedown(request, config) : fail('Method not allowed', 405);
  }
  const clear = /^\/api\/moderation\/takedown\/([^/]+)$/.exec(pathname);
  if (clear) {
    if (method !== 'DELETE') return fail('Method not allowed', 405);
    const slug = clear[1] ?? '';
    if (!isSlugId(slug)) return fail('Invalid slug', 400);
    await config.store.delete(tombstoneKey(slug));
    return json({ ok: true, novelSlug: slug });
  }
  return fail('Not found', 404);
}
