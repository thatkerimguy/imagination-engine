// The hosted Studio as a Cloudflare Worker with static assets (ADR 0030): the built Studio is
// served from out/studio/public, and the two server routes reuse the Pages Functions as they are.
//   /fetch    the audio relay (studio-functions/fetch.js)
//   /sync/*   device sync on the SYNC R2 bucket (studio-functions/sync.js)
import { onRequestGet as relay } from './studio-functions/fetch.js';
import { onRequest as sync } from './studio-functions/sync.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/fetch') {
      if (request.method !== 'GET') return new Response(null, { status: 405 });
      return relay({ request, env });
    }
    if (pathname === '/sync' || pathname.startsWith('/sync/')) {
      // Pages hands a [[path]] route its segments, decoded; do the same.
      const path = pathname
        .slice('/sync'.length)
        .split('/')
        .filter(Boolean)
        .map((segment) => decodeURIComponent(segment));
      return sync({ request, env, params: { path } });
    }
    return env.ASSETS.fetch(request);
  },
};
