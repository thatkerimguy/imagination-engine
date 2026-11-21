// Publishing from the phone: sanitize the book, PUT it to the publish API, remember the result.
// Pure of platform imports; `fetchImpl` and `readCover` are injectable for tests and native code.
import type { ChapterDocument } from '@kn/core';
import type {
  PublishCover,
  PublishRequest,
  PublishResponse,
  UnpublishResponse,
} from '../../../publish-api/src/protocol.ts';
import { loadItemMeta } from '../store/item-meta.ts';
import type { NovelRepository } from '../store/repository.ts';
import { prepareChapter } from '../store/sanitize.ts';
import {
  endpoint,
  failureOf,
  PUBLISH_TIMEOUT_MS,
  request,
  unconfigured,
  VERIFY_TIMEOUT_MS,
  defaultFetch,
  type FetchLike,
  type PublishFailure,
} from './publish-http.ts';
import { clearPublishStatus, savePublishStatus } from './publish-settings.ts';
import type { PublishConfig, PublishStatus } from './publish-settings.ts';

export interface UnlistedItem {
  seasonId: string;
  chapterId: string;
  title: string;
}

export interface PublishPlan {
  novelId: string;
  title: string;
  payload: PublishRequest;
  publishedChapters: number;
  unlistedChapters: number;
  draftChapters: number;
  unlistedItems: UnlistedItem[];
  /** First published chapter (for a "copy chapter link" / smoke); null when none. */
  firstPublished: UnlistedItem | null;
  warnings: string[];
  /** Unfinished blocks left out across all chapters (sanitizer) — informational. */
  skippedBlocks: number;
}

export type CoverReader = (uri: string) => Promise<PublishCover | null>;

const DATA_URI = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/;

/** Default cover reader: inline `data:` images only. */
export const readDataUriCover: CoverReader = async (uri) => {
  const m = DATA_URI.exec(uri.trim());
  if (!m) return null;
  return { mime: `image/${m[1]}` as PublishCover['mime'], base64: m[2]!.replace(/\s+/g, '') };
};

export async function inspectNovelForPublish(
  repo: NovelRepository,
  novelId: string,
  readCover: CoverReader = readDataUriCover,
): Promise<PublishPlan> {
  const bundle = await repo.exportNovel(novelId);
  const warnings: string[] = [];
  const unlistedItems: UnlistedItem[] = [];
  let firstPublished: UnlistedItem | null = null;
  let published = 0;
  let draft = 0;
  let skippedBlocks = 0;
  const seasons: PublishRequest['seasons'] = [];

  for (const { season, chapters } of bundle.seasons) {
    const sent: ChapterDocument[] = [];
    for (const raw of chapters) {
      if (raw.status === 'draft') {
        draft++;
        continue;
      }
      const prepared = prepareChapter(raw);
      if (!prepared.ok) {
        draft++;
        warnings.push(`"${raw.title}" could not be prepared and was left out.`);
        continue;
      }
      skippedBlocks += prepared.skipped.length;
      sent.push(prepared.chapter);
      const item = { seasonId: season.id, chapterId: raw.id, title: raw.title };
      if (raw.status === 'unlisted') unlistedItems.push(item);
      else {
        published++;
        firstPublished ??= item;
      }
    }
    seasons.push({ season, chapters: sent });
  }

  const unlisted = unlistedItems.length;
  if (published + unlisted === 0) {
    warnings.unshift(
      'All chapters are drafts — publishing will keep this book hidden from the public shelf.',
    );
  } else if (published === 0) {
    warnings.unshift(
      'No published chapters yet — unlisted chapters are reachable only by direct link.',
    );
  }
  if (skippedBlocks > 0) {
    warnings.push(
      `${skippedBlocks} unfinished ${skippedBlocks === 1 ? 'block' : 'blocks'} will be left out.`,
    );
  }

  const payload: PublishRequest = { novel: bundle.novel, seasons };
  const coverUri = (await loadItemMeta(repo, novelId)).coverUri;
  const cover = coverUri ? await readCover(coverUri).catch(() => null) : null;
  if (cover) payload.cover = cover;
  else if (coverUri) warnings.push('The cover image could not be read and will be left out.');

  return {
    novelId,
    title: bundle.novel.title,
    payload,
    publishedChapters: published,
    unlistedChapters: unlisted,
    draftChapters: draft,
    unlistedItems,
    firstPublished,
    warnings,
    skippedBlocks,
  };
}

// ── Network ───────────────────────────────────────────────────────────────────────────────

export type ConnectionState = 'ok' | 'unauthorized' | 'unreachable' | 'misconfigured';
export type { FetchLike, PublishFailure } from './publish-http.ts';

export async function verifyPublishConnection(
  apiUrl: string,
  token: string,
  fetchImpl: FetchLike = defaultFetch,
): Promise<{ state: ConnectionState; message: string }> {
  if (!apiUrl.trim() || !token.trim()) {
    return { state: 'misconfigured', message: 'Add the API URL and token first.' };
  }
  const res = await request(
    fetchImpl,
    `${apiUrl}/api/verify`,
    { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
    VERIFY_TIMEOUT_MS,
  );
  if (!res) return { state: 'unreachable', message: 'Could not reach server' };
  if (res.status === 200) return { state: 'ok', message: 'Connected' };
  if (res.status === 401 || res.status === 403) {
    return { state: 'unauthorized', message: 'Invalid token' };
  }
  if (res.status === 503) {
    return { state: 'misconfigured', message: 'Server has no publish token set' };
  }
  return { state: 'unreachable', message: 'Could not reach server' };
}

export async function publishNovelToApi(
  repo: NovelRepository,
  novelId: string,
  config: PublishConfig,
  token: string,
  fetchImpl: FetchLike = defaultFetch,
  readCover?: CoverReader,
): Promise<
  { ok: true; response: PublishResponse; status: PublishStatus; plan: PublishPlan } | PublishFailure
> {
  const missing = unconfigured(config, token);
  if (missing) return missing;
  const plan = await inspectNovelForPublish(repo, novelId, readCover);
  const res = await request(
    fetchImpl,
    endpoint(config, novelId),
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(plan.payload),
    },
    PUBLISH_TIMEOUT_MS,
  );
  const failure = await failureOf(res);
  if (failure || !res)
    return failure ?? { ok: false, kind: 'unreachable', error: 'Could not reach server' };
  const response = (await res.json()) as PublishResponse;
  const status: PublishStatus = {
    lastPublishedAt: response.publishedAt,
    publishedChapters: response.publishedChapters,
    unlistedChapters: response.unlistedChapters,
    publicListed: response.publicListed,
  };
  await savePublishStatus(repo, novelId, status);
  return { ok: true, response, status, plan };
}

export async function unpublishNovelFromApi(
  repo: NovelRepository,
  novelId: string,
  config: PublishConfig,
  token: string,
  fetchImpl: FetchLike = defaultFetch,
): Promise<{ ok: true; removedKeys: number } | PublishFailure> {
  const missing = unconfigured(config, token);
  if (missing) return missing;
  const res = await request(
    fetchImpl,
    endpoint(config, novelId),
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    VERIFY_TIMEOUT_MS,
  );
  const failure = await failureOf(res);
  if (failure || !res)
    return failure ?? { ok: false, kind: 'unreachable', error: 'Could not reach server' };
  const body = (await res.json()) as UnpublishResponse;
  await clearPublishStatus(repo, novelId);
  return { ok: true, removedKeys: body.removedKeys };
}
