// Handler configuration shared by every route module.
import type { RateLimiter } from './rate-limit.ts';
import type { ObjectStore } from './store.ts';

export interface HandlerConfig {
  store: ObjectStore;
  /** PUBLISH_TOKEN secret. Empty/undefined => every authed route answers 503 (never open). */
  token?: string;
  allowedOrigin?: string;
  jsonMaxAge?: number;
  now?: () => Date;
  /** Rate limiter (CF bindings or in-memory). Undefined => no limiting. */
  limiter?: RateLimiter;
  /** MODERATION_TOKEN secret (separate from `token`). Unset => moderation routes answer 503. */
  moderationToken?: string;
  /** MODERATION_WEBHOOK_URL (secret, optional): non-blocking alert POSTed on each new report. */
  moderationWebhookUrl?: string;
  /** PUBLIC_READER_URL: where the share page sends people. Unset => no redirect. */
  readerUrl?: string;
  /** ANDROID_PACKAGE for assetlinks.json (default `dev.kinetic.writer`). */
  androidPackage?: string;
  /** Raw comma-separated ANDROID_SHA256_CERT_FINGERPRINTS (normalised on output). */
  androidCertFingerprints?: string;
}
