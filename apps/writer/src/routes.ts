// Every screen path in one place (Expo Router file routes under src/app/).
const q = (params: Record<string, string | undefined>): string => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  return s.toString();
};

export const routes = {
  shelf: '/',
  /** Notes tab root: nested folders + standalone documents. */
  notes: '/folders',
  folder: (folderId: string) => `/folders/${folderId}`,
  /** A standalone note; `folderId` gives Back a parent after a reload. */
  note: (docId: string, folderId?: string | null) =>
    `/folders/note/${docId}${folderId ? `?${q({ folder: folderId })}` : ''}`,
  search: '/search',
  doctor: '/doctor',
  /** 30-day Trash (Settings → Backup & Restore). */
  trash: '/trash',
  lock: '/lock',
  /** Book compiler for a novel. */
  compile: (novelId: string) => `/novel/${novelId}/compile`,
  /** Book compiler for a Notes folder (its notes, in order, as chapters). */
  compileFolder: (folderId: string) => `/compile-folder?${q({ folder: folderId })}`,
  newNovel: '/new-novel',
  appSettings: '/settings',
  appearance: '/appearance',
  /** Growth charts for a target (`chapter:<id>`, `novel:<id>`…); chapter ids give Back a parent. */
  growth: (target: string, from?: { novel: string; season: string; chapter: string }) =>
    `/growth?${q({ target, novel: from?.novel, season: from?.season, chapter: from?.chapter })}`,
  outline: (novelId: string) => `/novel/${novelId}`,
  novelSettings: (novelId: string) => `/novel/${novelId}/settings`,
  /** `blockId` (e.g. from Search) scrolls to and selects that block on open. */
  chapter: (novelId: string, seasonId: string, chapterId: string, blockId?: string) =>
    `/novel/${novelId}/chapter/${seasonId}/${chapterId}${blockId ? `?${q({ block: blockId })}` : ''}`,
  /** Verified App Link landing (`https://<host>/share/<slug>`): local novel if present, else Library. */
  openLink: (slug: string) => `/open?${q({ novel: slug })}`,
  preview: (novelId: string, seasonId: string, chapterId: string, blockId?: string) =>
    `/preview?${q({ novel: novelId, season: seasonId, chapter: chapterId, block: blockId })}`,
} as const;

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Rewrites an incoming Android App Link (`https://<KN_APP_LINK_HOST>/share/<slug>` or `/r/<slug>`)
 * to the in-app `/open` landing. Any other path returns null (Expo Router keeps it as-is); a
 * malformed share link lands on the Library rather than an unmatched-route screen.
 */
export function appLinkRedirect(path: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(path, 'kn-app://local').pathname;
  } catch {
    return null;
  }
  const m = /^\/(share|r)(?:\/([^/]*))?\/?$/.exec(pathname);
  if (!m) return null;
  const slug = decodeURIComponent(m[2] ?? '');
  return SLUG.test(slug) ? routes.openLink(slug) : routes.shelf;
}

/** A sub-folder; `parentId` gives Back a parent folder after a reload. */
export const folderHref = (folderId: string, parentId: string | null): string =>
  parentId ? `/folders/${folderId}?${q({ parent: parentId })}` : `/folders/${folderId}`;

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
  if (['appearance', 'doctor', 'lock', 'trash'].includes(parts[0] ?? '')) return routes.appSettings;
  if (parts[0] === 'search') return null;
  if (parts[0] === 'folders') {
    if (parts.length === 1) return null;
    const folder = one('folder');
    if (parts[1] === 'note') return folder ? routes.folder(folder) : routes.notes;
    return one('parent') ? routes.folder(one('parent') ?? '') : routes.notes;
  }
  if (parts[0] === 'compile-folder') {
    const folder = one('folder');
    return folder ? routes.folder(folder) : routes.notes;
  }
  return routes.shelf;
}

/** The three root tabs (Library · Notes · Search) and which tab owns a path. */
export const TAB_ROOTS = [
  { key: 'library', href: routes.shelf, label: 'Library', icon: 'book' },
  { key: 'notes', href: routes.notes, label: 'Notes', icon: 'folder' },
  { key: 'search', href: routes.search, label: 'Search', icon: 'search' },
] as const;

export type TabKey = (typeof TAB_ROOTS)[number]['key'];

/** The tab whose bar should show on `pathname`, or `null` (deep screens hide the bar). */
export function tabForPath(pathname: string): TabKey | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return 'library';
  if (parts[0] === 'search' && parts.length === 1) return 'search';
  if (parts[0] === 'folders' && parts[1] !== 'note' && parts.length <= 2) return 'notes';
  return null;
}
