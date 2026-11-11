import { storyProjectSchema, type StoryProject } from '@ie/story';
import { z } from 'zod';

/** A story as the sync store holds it, with the version tag a guarded write must name. */
export interface RemoteCopy {
  readonly doc: StoryProject;
  readonly etag: string;
}

export interface RemoteSummary {
  readonly id: string;
  readonly title: { readonly en?: string; readonly tr?: string };
  readonly updatedAt: number;
}

/** The sync store (ADR 0024): the dev middleware, the hosted Pages Function, or a test double. */
export interface SyncRemote {
  list(): Promise<RemoteSummary[]>;
  get(id: string): Promise<RemoteCopy | null>;
  /** Writes only over `etag` (or only if there is no copy, when null). Null when that failed. */
  put(doc: StoryProject, etag: string | null): Promise<string | null>;
}

/** The store can't be reached or isn't there (no bucket, no dev server, offline). */
export class SyncUnavailable extends Error {}

const listSchema = z.array(
  z.object({
    id: z.string(),
    title: z.object({ en: z.string().optional(), tr: z.string().optional() }).catch({}),
    updatedAt: z.number(),
  }),
);

async function call(url: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...init });
  } catch (error) {
    throw new SyncUnavailable(String(error));
  }
  // 404 on the list, 501 (no bucket) and 403 (no Access) all mean: no sync here.
  if ([403, 501, 502, 503].includes(response.status)) {
    throw new SyncUnavailable(`sync store: ${response.status}`);
  }
  return response;
}

export function httpRemote(base = '/sync'): SyncRemote {
  const at = (id: string) => `${base}/projects/${encodeURIComponent(id)}`;
  return {
    async list() {
      const response = await call(`${base}/projects`);
      if (!response.ok) throw new SyncUnavailable(`sync list: ${response.status}`);
      return listSchema.parse(await response.json());
    },
    async get(id) {
      const response = await call(at(id));
      if (response.status === 204 || response.status === 404) return null;
      if (!response.ok) throw new Error(`sync get: ${response.status}`);
      const etag = response.headers.get('ETag');
      if (!etag) throw new Error('sync get: no ETag');
      // Never trust the wire: the copy is validated like any file the Studio opens.
      return { doc: storyProjectSchema.parse(await response.json()), etag };
    },
    async put(doc, etag) {
      const response = await call(at(doc.id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(etag ? { 'If-Match': etag } : { 'If-None-Match': '*' }),
        },
        body: JSON.stringify(doc),
      });
      if (response.status === 412) return null;
      if (!response.ok) throw new Error(`sync put: ${response.status}`);
      return response.headers.get('ETag') ?? '';
    },
  };
}
