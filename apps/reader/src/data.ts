// Static JSON loaders. Published books are plain files beside the reader (novels/<id>/...).
import {
  parseChapterDocument,
  parseNovelManifest,
  parseSeasonManifest,
  type ChapterDocument,
  type NovelManifest,
  type ParseResult,
  type SeasonManifest,
} from '@kn/core';

const cache = new Map<string, Promise<unknown>>();

/** Where books live: `./novels/` beside the reader, or VITE_NOVELS_BASE_URL (publish API / R2). */
export const novelsBase = (raw?: string): string => (raw || './novels').replace(/\/*$/, '/');
const BASE = novelsBase(import.meta.env.VITE_NOVELS_BASE_URL as string | undefined);
const at = (path: string): string => new URL(BASE + path, document.baseURI).href;

export const novelUrl = (novelId: string, path: string): string => at(`${novelId}/${path}`);

function fetchJson(url: string): Promise<unknown> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${r.status} loading ${url}`);
      return r.json() as Promise<unknown>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

async function load<T>(url: string, parse: (d: unknown) => ParseResult<T>): Promise<T> {
  const result = parse(await fetchJson(url));
  if (!result.ok) throw new Error(`Invalid ${url}:\n${result.errors.join('\n')}`);
  return result.value;
}

export async function loadLibrary(): Promise<string[]> {
  const data = await fetchJson(at('index.json'));
  const ids = (data as { novels?: unknown }).novels;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
}

export const loadNovel = (id: string): Promise<NovelManifest> =>
  load(novelUrl(id, 'novel.json'), parseNovelManifest);

export const loadSeason = (novelId: string, seasonId: string): Promise<SeasonManifest> =>
  load(novelUrl(novelId, `seasons/${seasonId}/season.json`), parseSeasonManifest);

export const loadChapter = (
  novelId: string,
  seasonId: string,
  chapterId: string,
): Promise<ChapterDocument> =>
  load(novelUrl(novelId, `seasons/${seasonId}/${chapterId}.json`), parseChapterDocument);
