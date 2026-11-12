// The hosted Studio as a Cloudflare Worker with static assets (ADR 0030): the built Studio is
// served from out/studio/public, and the two server routes reuse the Pages Functions as they are.
//   /fetch    the audio relay (studio-functions/fetch.js)
//   /sync/*   device sync on the SYNC R2 bucket (studio-functions/sync.js): projects and songs
import { onRequestGet as relay } from './studio-functions/fetch.js';
import { onRequest as sync } from './studio-functions/sync.js';

/** True behind Cloudflare Access, or where the owner opened the routes on purpose. */
function opened(env, request) {
  return (
    env.SYNC_OPEN === '1' ||
    env.RELAY_OPEN === '1' ||
    !!request.headers.get('Cf-Access-Jwt-Assertion')
  );
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/fetch') {
      if (request.method !== 'GET') return new Response(null, { status: 405 });
      // Access guards the whole site; this is the second lock, as sync has (ADR 0030).
      if (!opened(env, request))
        return new Response('Cloudflare Access is required.', { status: 403 });
      return relay({ request, env });
    }
    if (pathname === '/sync' || pathname.startsWith('/sync/')) {
      // Pages hands a [[path]] route its segments, decoded; do the same.
      let path;
      try {
        path = pathname
          .slice('/sync'.length)
          .split('/')
          .filter(Boolean)
          .map((segment) => decodeURIComponent(segment));
      } catch {
        return new Response('Bad path', { status: 400 });
      }
      return sync({ request, env, params: { path } });
    }
    return env.ASSETS.fetch(request);
  },
};
