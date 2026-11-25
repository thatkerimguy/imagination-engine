// Document Doctor checks for the novel → season → chapter tree and the notes folder tree.
import { parseChapterDocument, parseNovelManifest, parseSeasonManifest } from '@kn/core';
import { isRecord, type Entry, type Issue } from './doctor-types.ts';

const issue = (
  code: string,
  e: Entry,
  severity: Issue['severity'],
  title: string,
  detail: string,
  repair?: Issue['repair'],
  ref?: string,
): Issue => ({
  id: `${code}:${e.key}${ref ? `:${ref}` : ''}`,
  key: e.key,
  severity,
  title,
  detail,
  ...(repair ? { repair } : {}),
  ...(ref ? { ref } : {}),
});

export interface Tree {
  keys: Set<string>;
  byPrefix(prefix: string): Entry[];
}

const invalid = (e: Entry, what: string, errors: string[]): Issue =>
  issue(
    'invalid',
    e,
    'error',
    `Invalid ${what}`,
    errors.slice(0, 2).join('; '),
    'quarantine-remove',
  );

/** Ids with a `trash/<id>` record: unlinked on purpose (30-day Trash), never orphans. */
const trashedIn = (tree: Tree): Set<string> =>
  new Set(tree.byPrefix('trash/').map((e) => e.key.slice(6)));

/** Manifests, parent/child links and orphans across novels, seasons and chapters. */
export function checkTree(entries: readonly Entry[], tree: Tree): Issue[] {
  const out: Issue[] = [];
  const trashed = trashedIn(tree);
  const novels = new Map<string, string[]>(); // novelId -> season ids (valid novels only)
  const seasons = new Map<string, string[]>(); // `n/s` -> chapter ids (valid seasons only)
  for (const e of entries) {
    if (e.corrupt) continue;
    if (e.key.startsWith('novel/')) {
      const r = parseNovelManifest(e.data);
      if (r.ok) novels.set(e.key.slice(6), r.value.seasons);
      else out.push(invalid(e, 'book manifest', r.errors));
    } else if (e.key.startsWith('season/')) {
      const r = parseSeasonManifest(e.data);
      if (r.ok) seasons.set(e.key.slice(7), r.value.chapters);
      else out.push(invalid(e, 'season', r.errors));
    } else if (e.key.startsWith('chapter/')) {
      const r = parseChapterDocument(e.data);
      if (!r.ok) out.push(invalid(e, 'chapter', r.errors));
    }
  }
  for (const e of entries) {
    const [kind, a, b, c] = e.key.split('/');
    if (e.corrupt || !a) continue;
    if (kind === 'novel') {
      for (const s of novels.get(a) ?? []) {
        if (!tree.keys.has(`season/${a}/${s}`)) {
          out.push(
            issue(
              'missing-season',
              e,
              'warning',
              'Book lists a missing season',
              `Season “${s}” has no data.`,
              'drop-link',
              s,
            ),
          );
        }
      }
    } else if (kind === 'season' && b) {
      if (!tree.keys.has(`novel/${a}`)) {
        out.push(
          issue(
            'no-novel',
            e,
            'warning',
            'Season has no book',
            `Book “${a}” no longer exists.`,
            'quarantine-remove',
          ),
        );
      } else if (
        novels.has(a) &&
        !novels.get(a)?.includes(b) &&
        seasons.has(`${a}/${b}`) &&
        !trashed.has(b)
      ) {
        out.push(
          issue(
            'orphan-season',
            e,
            'warning',
            'Season not listed by its book',
            `“${b}” is stored but hidden from the book.`,
            'attach',
            b,
          ),
        );
      }
      for (const ch of seasons.get(`${a}/${b}`) ?? []) {
        if (!tree.keys.has(`chapter/${a}/${b}/${ch}`)) {
          out.push(
            issue(
              'missing-chapter',
              e,
              'warning',
              'Season lists a missing chapter',
              `Chapter “${ch}” has no data.`,
              'drop-link',
              ch,
            ),
          );
        }
      }
    } else if (kind === 'chapter' && b && c) {
      if (!tree.keys.has(`season/${a}/${b}`)) {
        out.push(
          issue(
            'no-season',
            e,
            'warning',
            'Chapter has no season',
            `Season “${b}” no longer exists.`,
            'quarantine-remove',
          ),
        );
      } else if (
        seasons.has(`${a}/${b}`) &&
        !seasons.get(`${a}/${b}`)?.includes(c) &&
        !trashed.has(c)
      ) {
        out.push(
          issue(
            'orphan-chapter',
            e,
            'warning',
            'Chapter not listed by its season',
            `“${c}” is stored but hidden from the season.`,
            'attach',
            c,
          ),
        );
      }
    }
  }
  return out;
}

/** Notes and folders whose parent folder is missing. */
export function checkFolders(entries: readonly Entry[], tree: Tree): Issue[] {
  const out: Issue[] = [];
  for (const e of entries) {
    const isFolder = e.key.startsWith('folder/');
    if (e.corrupt || !(isFolder || e.key.startsWith('doc/')) || !isRecord(e.data)) continue;
    const parent = e.data.parentFolderId;
    if (typeof parent === 'string' && !tree.keys.has(`folder/${parent}`)) {
      out.push(
        issue(
          'orphan-parent',
          e,
          'warning',
          `${isFolder ? 'Folder' : 'Note'} has a missing parent folder`,
          `Parent “${parent}” no longer exists.`,
          'move-root',
        ),
      );
    }
  }
  return out;
}
