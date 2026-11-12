// Cloudflare Pages Function: device sync for the hosted Studio (ADR 0024), on an R2 bucket bound
// as SYNC. Same protocol as the local store in apps/studio/vite.config.ts:
//   GET  /sync/projects        → [{ id, title, updatedAt }]
//   GET  /sync/projects/<id>   → the project JSON, with an ETag (204 when there is none)
//   PUT  /sync/projects/<id>   → stores it; If-Match <etag> or If-None-Match * guard against
//                                overwriting a newer copy (412 when the guard fails)
//   HEAD|GET /sync/files/audio/<id>.<ext>  → an imported song (204 when there is none)
//   PUT  /sync/files/audio/<id>.<ext>      → stores it once; names are unique, so never replaced
// The site sits behind Cloudflare Access; as a second lock, a request without Access's identity
// header is refused unless the SYNC_OPEN variable is "1".

const ID = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const MAX_BYTES = 25 * 1024 * 1024;
const PREFIX = 'projects/';
const FILE = /^[A-Za-z][A-Za-z0-9_]{0,63}\.[a-z0-9]{1,5}$/;
const MAX_FILE_BYTES = 60 * 1024 * 1024;

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...init.headers },
  });

export async function onRequest({ request, env, params }) {
  if (!env.SYNC) return new Response('No SYNC bucket is bound to this project.', { status: 501 });
  if (env.SYNC_OPEN !== '1' && !request.headers.get('Cf-Access-Jwt-Assertion'))
    return new Response('Cloudflare Access is required.', { status: 403 });

  const path = Array.isArray(params.path) ? params.path : [];
  if (path[0] === 'files') return file(request, env, path);
  if (path[0] !== 'projects' || path.length > 2) return new Response(null, { status: 404 });

  if (path.length === 1) {
    if (request.method !== 'GET') return new Response(null, { status: 405 });
    const out = [];
    let cursor;
    do {
      const page = await env.SYNC.list({ prefix: PREFIX, cursor, include: ['customMetadata'] });
      for (const o of page.objects) {
        out.push({
          id: o.key.slice(PREFIX.length).replace(/\.json$/, ''),
          title: safeTitle(o.customMetadata?.title),
          updatedAt: o.uploaded.getTime(),
        });
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return json(out);
  }

  const id = path[1];
  if (!ID.test(id)) return new Response('Bad id', { status: 400 });
  const key = `${PREFIX}${id}.json`;

  if (request.method === 'GET') {
    const object = await env.SYNC.get(key);
    // 204, not 404: no copy yet is a normal answer, and browsers log every 404.
    if (!object) return new Response(null, { status: 204 });
    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/json',
        ETag: object.httpEtag,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (request.method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_BYTES) return new Response(null, { status: 413 });
    let doc;
    try {
      doc = JSON.parse(text);
    } catch {
      return new Response('Not JSON', { status: 400 });
    }
    if (doc?.format !== 'imagination.story' || doc.id !== id)
      return new Response('Not this story', { status: 400 });
    const ifMatch = request.headers.get('If-Match');
    const ifNone = request.headers.get('If-None-Match');
    const onlyIf = ifMatch
      ? { etagMatches: ifMatch.replace(/^W\//, '').replaceAll('"', '') }
      : ifNone === '*'
        ? { etagDoesNotMatch: '*' }
        : undefined;
    if (!onlyIf) return new Response('If-Match or If-None-Match is required', { status: 428 });
    if (ifNone === '*' && (await env.SYNC.head(key))) return new Response(null, { status: 412 });
    const stored = await env.SYNC.put(key, text, {
      onlyIf: ifMatch ? onlyIf : undefined,
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { title: JSON.stringify(doc.title ?? {}).slice(0, 1000) },
    });
    // R2 returns null when the onlyIf condition fails: someone saved a newer copy first.
    if (!stored) return new Response(null, { status: 412 });
    return json({ ok: true }, { headers: { ETag: stored.httpEtag } });
  }

  return new Response(null, { status: 405 });
}

/** Imported songs travel beside the projects that play them (their tracks name `audio/<file>`). */
async function file(request, env, path) {
  if (path.length !== 3 || path[1] !== 'audio' || !FILE.test(path[2]))
    return new Response('Bad file name', { status: 400 });
  const key = `files/audio/${path[2]}`;
  if (request.method === 'HEAD') {
    return new Response(null, { status: (await env.SYNC.head(key)) ? 200 : 204 });
  }
  if (request.method === 'GET') {
    const object = await env.SYNC.get(key);
    if (!object) return new Response(null, { status: 204 });
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  }
  if (request.method === 'PUT') {
    const size = Number(request.headers.get('Content-Length') ?? 0);
    if (size > MAX_FILE_BYTES) return new Response(null, { status: 413 });
    if (await env.SYNC.head(key)) return json({ ok: true });
    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_FILE_BYTES) return new Response(null, { status: 413 });
    await env.SYNC.put(key, body, {
      httpMetadata: {
        contentType: request.headers.get('Content-Type') ?? 'application/octet-stream',
      },
    });
    return json({ ok: true });
  }
  return new Response(null, { status: 405 });
}

function safeTitle(raw) {
  try {
    const t = JSON.parse(raw ?? '{}');
    return {
      en: typeof t.en === 'string' ? t.en : undefined,
      tr: typeof t.tr === 'string' ? t.tr : undefined,
    };
  } catch {
    return {};
  }
}
