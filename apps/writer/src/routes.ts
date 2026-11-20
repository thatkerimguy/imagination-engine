// Every screen path in one place (Expo Router file routes under src/app/).
const q = (params: Record<string, string | undefined>): string => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  return s.toString();
};

export const routes = {
  shelf: '/',
  newNovel: '/new-novel',
  appSettings: '/settings',
  appearance: '/appearance',
  /** Growth charts for a target (`chapter:<id>`, `novel:<id>`…); chapter ids give Back a parent. */
  growth: (target: string, from?: { novel: string; season: string; chapter: string }) =>
    `/growth?${q({ target, novel: from?.novel, season: from?.season, chapter: from?.chapter })}`,
  outline: (novelId: string) => `/novel/${novelId}`,
  novelSettings: (novelId: string) => `/novel/${novelId}/settings`,
  chapter: (novelId: string, seasonId: string, chapterId: string) =>
    `/novel/${novelId}/chapter/${seasonId}/${chapterId}`,
  preview: (novelId: string, seasonId: string, chapterId: string, blockId?: string) =>
    `/preview?${q({ novel: novelId, season: seasonId, chapter: chapterId, block: blockId })}`,
} as const;

/**
 * The logical parent of a screen, so Back always works — even after a deep link or a web
 * reload where there is no navigation history. `null` for the bookshelf (the root).
 */
export function parentHref(
  pathname: string,
  params: Readonly<Record<string, string | string[] | undefined>>,
): string | null {
  const one = (k: string): string | undefined => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0] === 'novel' && parts[1]) {
    return parts.length > 2 ? routes.outline(parts[1]) : routes.shelf;
  }
  if (parts[0] === 'preview' || parts[0] === 'growth') {
    const [n, s, c] = [one('novel'), one('season'), one('chapter')];
    return n && s && c ? routes.chapter(n, s, c) : routes.shelf;
  }
  if (parts[0] === 'appearance') return routes.appSettings;
  return routes.shelf;
}
