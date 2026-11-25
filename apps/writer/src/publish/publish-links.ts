// Reader links for published books. Query-string routes match apps/reader's `parseRoute`.
import { normalizeBaseUrl } from './publish-settings.ts';

function link(readerUrl: string, params: Record<string, string>): string {
  const base = normalizeBaseUrl(readerUrl) ?? readerUrl.trim().replace(/\/+$/, '');
  return `${base}/?${new URLSearchParams(params).toString()}`;
}

export const publicNovelUrl = (readerUrl: string, novelId: string): string =>
  link(readerUrl, { novel: novelId });

export const chapterUrl = (
  readerUrl: string,
  novelId: string,
  seasonId: string,
  chapterId: string,
): string => link(readerUrl, { novel: novelId, season: seasonId, chapter: chapterId });
