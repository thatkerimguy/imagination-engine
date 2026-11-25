// Cloudflare module-worker entry. Bindings: NOVELS_BUCKET (R2), PUBLISH_TOKEN (secret).
import { handleRequest } from './worker.ts';
import { createR2Store } from './store.ts';
import type { R2BucketLike } from './store.ts';
import { createMemoryLimiter } from './rate-limit.ts';
import type { RateLimitBinding } from './rate-limit.ts';

// Fallback when the rate-limit bindings are not configured (per isolate, best effort).
const fallbackLimiter = createMemoryLimiter();

export interface Env {
  NOVELS_BUCKET: R2BucketLike;
  PUBLISH_TOKEN?: string;
  ALLOWED_ORIGIN?: string;
  JSON_MAX_AGE?: string;
  /** Secret. Never falls back to PUBLISH_TOKEN. */
  MODERATION_TOKEN?: string;
  PUBLIC_READER_URL?: string;
  ANDROID_PACKAGE?: string;
  ANDROID_SHA256_CERT_FINGERPRINTS?: string;
  /** Cloudflare Rate Limiting bindings (5 and 30 requests per 60s). */
  REPORT_LIMITER?: RateLimitBinding;
  PUBLISH_LIMITER?: RateLimitBinding;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const maxAge = Number(env.JSON_MAX_AGE);
    return handleRequest(request, {
      store: createR2Store(env.NOVELS_BUCKET),
      ...(env.PUBLISH_TOKEN ? { token: env.PUBLISH_TOKEN } : {}),
      ...(env.ALLOWED_ORIGIN ? { allowedOrigin: env.ALLOWED_ORIGIN } : {}),
      limiter:
        env.REPORT_LIMITER && env.PUBLISH_LIMITER
          ? { report: env.REPORT_LIMITER, publish: env.PUBLISH_LIMITER }
          : fallbackLimiter,
      ...(env.MODERATION_TOKEN ? { moderationToken: env.MODERATION_TOKEN } : {}),
      ...(env.PUBLIC_READER_URL ? { readerUrl: env.PUBLIC_READER_URL } : {}),
      ...(env.ANDROID_PACKAGE ? { androidPackage: env.ANDROID_PACKAGE } : {}),
      ...(env.ANDROID_SHA256_CERT_FINGERPRINTS
        ? { androidCertFingerprints: env.ANDROID_SHA256_CERT_FINGERPRINTS }
        : {}),
      ...(env.JSON_MAX_AGE && Number.isFinite(maxAge) ? { jsonMaxAge: maxAge } : {}),
    });
  },
};
