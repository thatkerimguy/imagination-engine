// Query-string routes keep the reader a single static page that works from any folder on any
// host; the hash stays free for block deep links (#b-<blockId>).
export type Route =
  | { view: 'shelf' }
  | { view: 'seasons'; novel: string }
  | { view: 'chapters'; novel: string; season: string }
  | { view: 'read'; novel: string; season: string; chapter: string; block: string | null };

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function parseRoute(search: string, hash: string): Route {
  const q = new URLSearchParams(search);
  const get = (k: string): string | null => {
    const v = q.get(k);
    return v && SLUG.test(v) ? v : null;
  };
  const novel = get('novel');
  const season = get('season');
  const chapter = get('chapter');
  if (!novel) return { view: 'shelf' };
  if (!season) return { view: 'seasons', novel };
  if (!chapter) return { view: 'chapters', novel, season };
  const block = /^#b-([0-9A-HJKMNP-TV-Z]{26})$/.exec(hash)?.[1] ?? null;
  return { view: 'read', novel, season, chapter, block };
}

export function routeHref(route: Route): string {
  const q = new URLSearchParams();
  if (route.view !== 'shelf') q.set('novel', route.novel);
  if (route.view === 'chapters' || route.view === 'read') q.set('season', route.season);
  if (route.view === 'read') q.set('chapter', route.chapter);
  const search = q.toString();
  const hash = route.view === 'read' && route.block ? `#b-${route.block}` : '';
  return `${search ? `?${search}` : './'}${hash}`;
}
