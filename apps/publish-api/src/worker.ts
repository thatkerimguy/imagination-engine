// Runtime-agnostic request handler shared by the Cloudflare Worker and the local Node server.
import { extractBearer, tokenMatches } from './auth.ts';
import { PublishError, publishNovel, unpublishNovel } from './publish.ts';
import { MAX_BODY_BYTES, PROTOCOL_VERSION, isSlugId } from './protocol.ts';
import type { HandlerConfig } from './config.ts';
import { fail, json, readCappedJson } from './http.ts';
import { checkRateLimit, clientKey } from './rate-limit.ts';
import { routeUgc, tooMany } from './routes-ugc.ts';
import { TAKEN_DOWN_MESSAGE, isTakenDown } from './takedown.ts';

export type { HandlerConfig };

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Minimal ExecutionContext subset (Cloudflare Workers). */
export interface WaitUntilContext {
  waitUntil(promise: Promise<unknown>): void;
}

export async function handleRequest(
  request: Request,
  config: HandlerConfig,
  ctx?: WaitUntilContext,
): Promise<Response> {
  const origin = config.allowedOrigin ?? '*';
  const finish = (res: Response): Response => {
    res.headers.set('Access-Control-Allow-Origin', origin);
    return res;
  };
  try {
    return finish(await route(request, config, ctx));
  } catch (err) {
    if (err instanceof PublishError)
      return finish(json({ ok: false, error: err.message }, err.status));
    return finish(json({ ok: false, error: 'Internal error' }, 500));
  }
}

/** Returns an error Response when the caller is not allowed in, otherwise null. */
function authorize(request: Request, token: string | undefined): Response | null {
  if (!token) return fail('Publishing is not configured', 503);
  const provided = extractBearer(request);
  if (provided === null || !tokenMatches(provided, token)) {
    return fail('Missing or invalid token', 401);
  }
  return null;
}

async function route(
  request: Request,
  config: HandlerConfig,
  ctx?: WaitUntilContext,
): Promise<Response> {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (pathname === '/api/health') {
    if (method !== 'GET') return fail('Method not allowed', 405);
    return json({ ok: true, version: PROTOCOL_VERSION });
  }
  if (pathname === '/api/verify') {
    if (method !== 'GET') return fail('Method not allowed', 405);
    return authorize(request, config.token) ?? json({ ok: true, authed: true });
  }

  const novelMatch = /^\/api\/novels\/([^/]+)$/.exec(pathname);
  if (novelMatch) {
    if (method !== 'PUT' && method !== 'DELETE') return fail('Method not allowed', 405);
    if (!(await checkRateLimit(config.limiter, 'publish', clientKey(request)))) return tooMany();
    const denied = authorize(request, config.token);
    if (denied) return denied;
    const novelId = novelMatch[1] ?? '';
    if (!isSlugId(novelId)) return fail('Invalid novel id', 400);
    if (method === 'DELETE') return json(await unpublishNovel(config.store, novelId));
    if (await isTakenDown(config.store, novelId)) return fail(TAKEN_DOWN_MESSAGE, 410);
    const body = await readCappedJson(request, MAX_BODY_BYTES);
    if (body instanceof Response) return body;
    const now = (config.now ?? (() => new Date()))();
    return json(await publishNovel(config.store, novelId, body, now));
  }

  const ugc = await routeUgc(request, pathname, config, ctx);
  if (ugc) return ugc;

  if (pathname.startsWith('/novels/')) {
    if (method !== 'GET' && method !== 'HEAD') return fail('Method not allowed', 405);
    return readPublic(pathname, method === 'HEAD', config);
  }
  return fail('Not found', 404);
}

async function readPublic(
  pathname: string,
  headOnly: boolean,
  config: HandlerConfig,
): Promise<Response> {
  let segments: string[];
  try {
    segments = pathname
      .split('/')
      .filter((s) => s !== '')
      .map((s) => decodeURIComponent(s));
  } catch {
    return fail('Bad path', 400);
  }
  const safe = segments.every((s) => SEGMENT.test(s) && !s.includes('..'));
  if (!safe || segments[0] !== 'novels' || segments.length < 2) return fail('Bad path', 400);

  const slug = segments[1] ?? '';
  if (isSlugId(slug) && (await isTakenDown(config.store, slug))) {
    return fail(TAKEN_DOWN_MESSAGE, 410);
  }
  const obj = await config.store.get(segments.join('/'));
  if (!obj) return fail('Not found', 404);
  const maxAge = config.jsonMaxAge ?? 60;
  const headers = new Headers({
    'content-type': obj.contentType,
    'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=300`,
  });
  if (obj.etag) headers.set('ETag', obj.etag);
  return new Response(headOnly ? null : (obj.body as BodyInit), { status: 200, headers });
}
