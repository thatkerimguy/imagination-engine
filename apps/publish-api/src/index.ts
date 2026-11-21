// Cloudflare module-worker entry. Bindings: NOVELS_BUCKET (R2), PUBLISH_TOKEN (secret).
import { handleRequest } from './worker.ts';
import { createR2Store } from './store.ts';
import type { R2BucketLike } from './store.ts';

export interface Env {
  NOVELS_BUCKET: R2BucketLike;
  PUBLISH_TOKEN?: string;
  ALLOWED_ORIGIN?: string;
  JSON_MAX_AGE?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const maxAge = Number(env.JSON_MAX_AGE);
    return handleRequest(request, {
      store: createR2Store(env.NOVELS_BUCKET),
      ...(env.PUBLISH_TOKEN ? { token: env.PUBLISH_TOKEN } : {}),
      ...(env.ALLOWED_ORIGIN ? { allowedOrigin: env.ALLOWED_ORIGIN } : {}),
      ...(env.JSON_MAX_AGE && Number.isFinite(maxAge) ? { jsonMaxAge: maxAge } : {}),
    });
  },
};
