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

export const novelUrl = (novelId: string, path: string): string =>
  new URL(`novels/${novelId}/${path}`, document.baseURI).href;

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
  const data = await fetchJson(new URL('novels/index.json', document.baseURI).href);
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
