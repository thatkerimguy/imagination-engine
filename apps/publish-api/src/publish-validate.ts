// Pure validation of a publish body. Nothing here touches the store, so a bad payload can never
// leave partial state behind.
import {
  parseChapterDocument,
  parseNovelManifest,
  parseSeasonManifest,
  type ChapterDocument,
  type NovelManifest,
  type SeasonManifest,
} from '@kn/core';
import { COVER_MIMES, MAX_COVER_BYTES, isSlugId, type CoverMime } from './protocol.ts';

export class PublishError extends Error {
  status: 400 | 413;
  constructor(status: 400 | 413, message: string) {
    super(message);
    this.name = 'PublishError';
    this.status = status;
  }
}

export interface ValidSeason {
  season: SeasonManifest;
  chapters: ChapterDocument[];
}

export interface ValidBook {
  novel: NovelManifest;
  seasons: ValidSeason[];
  cover: { mime: CoverMime; bytes: Uint8Array } | null;
}

const COVER_EXT: Record<CoverMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
export const coverExtension = (mime: CoverMime): string => COVER_EXT[mime];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(what: string, errors: string[]): never {
  throw new PublishError(400, `Invalid ${what}: ${errors.slice(0, 5).join('; ')}`);
}

function decodeCover(raw: unknown): ValidBook['cover'] {
  if (raw === undefined || raw === null) return null;
  if (!isRecord(raw)) throw new PublishError(400, 'cover must be an object');
  const { mime, base64 } = raw;
  const okMime = COVER_MIMES.find((m) => m === mime);
  if (!okMime) throw new PublishError(400, `cover.mime must be one of ${COVER_MIMES.join(', ')}`);
  if (typeof base64 !== 'string') throw new PublishError(400, 'cover.base64 must be a string');
  // Reject before decoding when the encoded size already proves the image is too large.
  if ((base64.length * 3) / 4 > MAX_COVER_BYTES + 3) {
    throw new PublishError(413, 'Cover image is too large');
  }
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new PublishError(400, 'cover.base64 is not valid base64');
  }
  if (binary.length > MAX_COVER_BYTES) throw new PublishError(413, 'Cover image is too large');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mime: okMime, bytes };
}

export function validateBook(novelId: string, body: unknown): ValidBook {
  if (!isSlugId(novelId)) throw new PublishError(400, 'Invalid novel id');
  if (!isRecord(body)) throw new PublishError(400, 'Body must be a JSON object');
  if (!Array.isArray(body.seasons)) throw new PublishError(400, 'seasons must be an array');

  const novelResult = parseNovelManifest(body.novel);
  if (!novelResult.ok) fail('novel', novelResult.errors);
  const novel = novelResult.value;
  if (novel.id !== novelId) throw new PublishError(400, 'novel.id does not match the URL');

  const seasons: ValidSeason[] = [];
  const seasonIds = new Set<string>();
  const chapterIds = new Set<string>();
  for (const entry of body.seasons as unknown[]) {
    if (!isRecord(entry) || !Array.isArray(entry.chapters)) {
      throw new PublishError(400, 'Each season entry needs { season, chapters[] }');
    }
    const s = parseSeasonManifest(entry.season);
    if (!s.ok) fail('season', s.errors);
    if (seasonIds.has(s.value.id)) throw new PublishError(400, `Duplicate season ${s.value.id}`);
    seasonIds.add(s.value.id);
    if (!novel.seasons.includes(s.value.id)) {
      throw new PublishError(400, `Season ${s.value.id} is not listed in novel.seasons`);
    }
    const chapters: ChapterDocument[] = [];
    for (const raw of entry.chapters as unknown[]) {
      const c = parseChapterDocument(raw);
      if (!c.ok) fail('chapter', c.errors);
      if (c.value.seasonId !== s.value.id) {
        throw new PublishError(400, `Chapter ${c.value.id} belongs to another season`);
      }
      if (chapterIds.has(c.value.id)) {
        throw new PublishError(400, `Duplicate chapter ${c.value.id}`);
      }
      chapterIds.add(c.value.id);
      chapters.push(c.value);
    }
    seasons.push({ season: s.value, chapters });
  }
  return { novel, seasons, cover: decodeCover(body.cover) };
}
