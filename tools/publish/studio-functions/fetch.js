// Cloudflare Pages Function: the Studio's audio relay when it is hosted (ADR 0022).
// Same rules as the local relay in apps/studio/vite.config.ts: GET, https, allowlisted hosts.
const RELAY_HOSTS = [
  /^api\.audius\.co$/,
  /(^|\.)jamendo\.com$/,
  /(^|\.)freesound\.org$/,
  /^upload\.wikimedia\.org$/,
  /(^|\.)ccmixter\.org$/,
  /(^|\.)openverse\.org$/,
];
const RELAY_MAX_BYTES = 60 * 1024 * 1024;

export async function onRequestGet({ request }) {
  let url;
  try {
    url = new URL(new URL(request.url).searchParams.get('url') ?? '');
  } catch {
    return new Response('Bad url', { status: 400 });
  }
  if (url.protocol !== 'https:' || !RELAY_HOSTS.some((h) => h.test(url.hostname)))
    return new Response('Not allowed', { status: 403 });
  const upstream = await fetch(url, { redirect: 'follow' });
  const length = Number(upstream.headers.get('content-length') ?? 0);
  if (!upstream.ok) return new Response(null, { status: upstream.status });
  if (length > RELAY_MAX_BYTES) return new Response(null, { status: 413 });
  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
