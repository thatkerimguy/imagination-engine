// Wire contract between apps/writer (client) and apps/publish-api (Worker). Payload documents are
// `unknown` on purpose: the Worker re-validates every one with @kn/core before writing anything.

export const PROTOCOL_VERSION = 1;

/** Request body limits (bytes). The cover limit applies to the decoded image. */
export const MAX_BODY_BYTES = 5 * 1024 * 1024;
export const MAX_COVER_BYTES = 1.5 * 1024 * 1024;

export const COVER_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type CoverMime = (typeof COVER_MIMES)[number];

export interface PublishCover {
  mime: CoverMime;
  base64: string;
}

/** `PUT /api/novels/:novelId` body: the whole book, sanitized by the writer. */
export interface PublishRequest {
  novel: unknown;
  seasons: Array<{ season: unknown; chapters: unknown[] }>;
  cover?: PublishCover;
}

export interface PublishResponse {
  ok: true;
  novelId: string;
  publishedChapters: number;
  unlistedChapters: number;
  skippedDrafts: number;
  /** Stale objects removed under `novels/<novelId>/` (deleted or demoted chapters). */
  removedKeys: number;
  publishedAt: string;
  /** Whether the book is on the public shelf (`novels/index.json`). */
  publicListed: boolean;
}

/** `DELETE /api/novels/:novelId` result. */
export interface UnpublishResponse {
  ok: true;
  novelId: string;
  removedKeys: number;
}

export interface HealthResponse {
  ok: true;
  version: typeof PROTOCOL_VERSION;
}

export interface VerifyResponse {
  ok: true;
  authed: true;
}

export interface ErrorResponse {
  ok: false;
  error: string;
}

/** Same slug rule as @kn/core ids (novel / season / chapter). Rejects `..`, `/` and empties. */
export const isSlugId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);
