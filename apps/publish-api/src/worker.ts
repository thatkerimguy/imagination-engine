// Runtime-agnostic request handler shared by the Cloudflare Worker and the local Node server.
import { extractBearer, tokenMatches } from './auth.ts';
import { PublishError, publishNovel, unpublishNovel } from './publish.ts';
import { MAX_BODY_BYTES, PROTOCOL_VERSION, isSlugId } from './protocol.ts';
import type { ErrorResponse } from './protocol.ts';
import type { ObjectStore } from './store.ts';

export interface HandlerConfig {
  store: ObjectStore;
  /** PUBLISH_TOKEN secret. Empty/undefined => every authed route answers 503 (never open). */
  token?: string;
  allowedOrigin?: string;
  jsonMaxAge?: number;
  now?: () => Date;
}

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export async function handleRequest(request: Request, config: HandlerConfig): Promise<Response> {
  const origin = config.allowedOrigin ?? '*';
  const finish = (res: Response): Response => {
    res.headers.set('Access-Control-Allow-Origin', origin);
    return res;
  };
  try {
    return finish(await route(request, config));
  } catch (err) {
    if (err instanceof PublishError)
      return finish(json({ ok: false, error: err.message }, err.status));
    return finish(json({ ok: false, error: 'Internal error' }, 500));
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const fail = (error: string, status: number): Response => {
  const body: ErrorResponse = { ok: false, error };
  return json(body, status);
};

/** Returns an error Response when the caller is not allowed in, otherwise null. */
function authorize(request: Request, token: string | undefined): Response | null {
  if (!token) return fail('Publishing is not configured', 503);
  const provided = extractBearer(request);
  if (provided === null || !tokenMatches(provided, token)) {
    return fail('Missing or invalid token', 401);
  }
  return null;
}

async function route(request: Request, config: HandlerConfig): Promise<Response> {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
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
    const denied = authorize(request, config.token);
    if (denied) return denied;
    const novelId = novelMatch[1] ?? '';
    if (!isSlugId(novelId)) return fail('Invalid novel id', 400);
    if (method === 'DELETE') return json(await unpublishNovel(config.store, novelId));
    const body = await readJsonBody(request);
    if (body instanceof Response) return body;
    const now = (config.now ?? (() => new Date()))();
    return json(await publishNovel(config.store, novelId, body, now));
  }

  if (pathname.startsWith('/novels/')) {
    if (method !== 'GET' && method !== 'HEAD') return fail('Method not allowed', 405);
    return readPublic(pathname, method === 'HEAD', config);
  }
  return fail('Not found', 404);
}

async function readJsonBody(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return fail('Request body too large', 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_BODY_BYTES) return fail('Request body too large', 413);
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return fail('Body is not valid JSON', 400);
  }
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
