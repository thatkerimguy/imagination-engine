// Routing for the user-generated-content surface: reports, moderation, legal, OG, share, links.
import type { HandlerConfig } from './config.ts';
import { assetLinksResponse } from './assetlinks.ts';
import { fail } from './http.ts';
import { legalPage } from './legal-pages.ts';
import { routeModeration } from './moderation.ts';
import { ogImageResponse } from './og-image.ts';
import { checkRateLimit, clientKey } from './rate-limit.ts';
import { handleReport } from './reports.ts';
import { shareResponse } from './share.ts';
import type { WaitUntilContext } from './worker.ts';

export const tooMany = (): Response => fail('Too many requests', 429, { 'Retry-After': '60' });

const isRead = (m: string): boolean => m === 'GET' || m === 'HEAD';

/** Returns null when the path is not part of the UGC surface. */
export async function routeUgc(
  request: Request,
  pathname: string,
  config: HandlerConfig,
  ctx?: WaitUntilContext,
): Promise<Response | null> {
  const method = request.method.toUpperCase();

  if (pathname === '/api/reports') {
    if (method !== 'POST') return fail('Method not allowed', 405);
    if (!(await checkRateLimit(config.limiter, 'report', clientKey(request)))) return tooMany();
    return handleReport(request, config, ctx);
  }
  const moderation = await routeModeration(request, pathname, config);
  if (moderation) return moderation;

  const legal = /^\/legal\/(terms|privacy|takedown)$/.exec(pathname);
  const og = /^\/og\/([^/]+)\.png$/.exec(pathname);
  const share = /^\/(?:share|r)\/([^/]+)$/.exec(pathname);
  const isLinks = pathname === '/.well-known/assetlinks.json';
  if (!legal && !og && !share && !isLinks) return null;
  if (!isRead(method)) return fail('Method not allowed', 405);

  if (legal) return legalPage(legal[1] ?? '', new URL(request.url));
  if (og) return ogImageResponse(og[1] ?? '', config);
  if (share) return shareResponse(share[1] ?? '', request, config);
  return assetLinksResponse(config);
}
