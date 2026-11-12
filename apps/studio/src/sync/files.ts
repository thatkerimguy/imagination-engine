import type { FileStore } from '@ie/core';
import type { StoryProject } from '@ie/story';
import { SyncUnavailable } from './remote.ts';

/*
 * Imported songs travel with device sync (ADR 0024): a track keeps its audio in this device's
 * OPFS under `audio/<id>.<ext>`, so a story synced to another device would list the song but have
 * nothing to play. Names are unique per import, so a file is written once and never replaced.
 */

/** The song store beside the projects: the dev middleware, the hosted function, or a test double. */
export interface FileRemote {
  has(path: string): Promise<boolean>;
  get(path: string): Promise<Blob | null>;
  put(path: string, data: Blob): Promise<void>;
}

/** Remembers which files the store already holds, so each sync doesn't ask again. */
export interface KnownFiles {
  has(path: string): Promise<boolean>;
  add(path: string): Promise<void>;
}

export interface FileSyncOutcome {
  readonly uploaded: number;
  readonly downloaded: number;
  /** Songs neither this device nor the store has (imported on a device that never synced them). */
  readonly missing: number;
  /** Songs that couldn't be moved this time (too big for the store, say); tried again next sync. */
  readonly failed: number;
}

/** The stored files a story's tracks play. */
export function audioPaths(doc: StoryProject): string[] {
  const paths = new Set<string>();
  for (const track of doc.audio?.tracks ?? [])
    if (track.source.kind === 'file') paths.add(track.source.path);
  return [...paths];
}

export async function syncAudioFiles(
  doc: StoryProject,
  remote: FileRemote,
  local: FileStore,
  known: KnownFiles,
): Promise<FileSyncOutcome> {
  let uploaded = 0;
  let downloaded = 0;
  let missing = 0;
  let failed = 0;
  for (const path of audioPaths(doc)) {
    try {
      const here = await local.read(path);
      if (here) {
        if (await known.has(path)) continue;
        if (!(await remote.has(path))) {
          await remote.put(path, here);
          uploaded++;
        }
        await known.add(path);
        continue;
      }
      const there = await remote.get(path);
      if (!there) {
        missing++;
        continue;
      }
      await local.write(path, there);
      await known.add(path);
      downloaded++;
    } catch (error) {
      // An unreachable store stops the round; one song it refuses doesn't hold up the others.
      if (error instanceof SyncUnavailable) throw error;
      console.warn(`Song ${path} did not sync.`, error);
      failed++;
    }
  }
  return { uploaded, downloaded, missing, failed };
}

async function call(url: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...init });
  } catch (error) {
    throw new SyncUnavailable(String(error));
  }
  if ([403, 501, 502, 503].includes(response.status))
    throw new SyncUnavailable(`sync files: ${response.status}`);
  return response;
}

export function httpFileRemote(base = '/sync'): FileRemote {
  // Paths are `audio/<name>`: each segment is encoded, the slash between them kept.
  const at = (path: string) => `${base}/files/${path.split('/').map(encodeURIComponent).join('/')}`;
  return {
    async has(path) {
      const response = await call(at(path), { method: 'HEAD' });
      return response.status === 200;
    },
    async get(path) {
      const response = await call(at(path));
      if (response.status === 204 || response.status === 404) return null;
      if (!response.ok) throw new Error(`sync file get: ${response.status}`);
      return response.blob();
    },
    async put(path, data) {
      const response = await call(at(path), {
        method: 'PUT',
        headers: { 'Content-Type': data.type || 'application/octet-stream' },
        body: data,
      });
      if (!response.ok) throw new Error(`sync file put: ${response.status}`);
    },
  };
}
