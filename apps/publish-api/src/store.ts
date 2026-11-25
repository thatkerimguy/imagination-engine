// Storage seam for the publish API. The Worker talks to R2 through `createR2Store`; tests and the
// local Node harness use `createMemoryStore`. The R2 types below are the tiny subset we call, so
// the package needs no @cloudflare/workers-types download.

export interface StoredObject {
  body: Uint8Array;
  contentType: string;
  etag?: string;
}

export interface ObjectStore {
  get(key: string): Promise<StoredObject | null>;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Every key starting with `prefix` (all pages), sorted. */
  list(prefix: string): Promise<string[]>;
}

// ── Minimal R2 surface (structurally compatible with the Workers runtime binding) ───────────────

export interface R2ObjectBodyLike {
  readonly httpEtag?: string;
  readonly httpMetadata?: { contentType?: string };
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2ListResultLike {
  objects: Array<{ key: string }>;
  truncated: boolean;
  cursor?: string;
}

export interface R2BucketLike {
  get(key: string): Promise<R2ObjectBodyLike | null>;
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<R2ListResultLike>;
}

const FALLBACK_TYPE = 'application/octet-stream';

export function createR2Store(bucket: R2BucketLike): ObjectStore {
  return {
    async get(key) {
      const obj = await bucket.get(key);
      if (!obj) return null;
      return {
        body: new Uint8Array(await obj.arrayBuffer()),
        contentType: obj.httpMetadata?.contentType ?? FALLBACK_TYPE,
        ...(obj.httpEtag ? { etag: obj.httpEtag } : {}),
      };
    },
    async put(key, body, contentType) {
      await bucket.put(key, body, { httpMetadata: { contentType } });
    },
    async delete(key) {
      await bucket.delete(key);
    },
    async list(prefix) {
      const out: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await bucket.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
        for (const o of page.objects) out.push(o.key);
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      return out.sort();
    },
  };
}

/** In-memory store for tests and the local Node harness. Bodies are copied in and out. */
export function createMemoryStore(): ObjectStore {
  const objects = new Map<string, { body: Uint8Array; contentType: string; version: number }>();
  let version = 0;
  return {
    async get(key) {
      const o = objects.get(key);
      if (!o) return null;
      return { body: o.body.slice(), contentType: o.contentType, etag: `"v${o.version}"` };
    },
    async put(key, body, contentType) {
      objects.set(key, { body: body.slice(), contentType, version: ++version });
    },
    async delete(key) {
      objects.delete(key);
    },
    async list(prefix) {
      return [...objects.keys()].filter((k) => k.startsWith(prefix)).sort();
    },
  };
}
