// Document Doctor checks for chapter modules, sidecars and media addresses.
import { parseChapterDocument } from '@kn/core';
import type { Tree } from './doctor-links.ts';
import {
  isRecord,
  type Entry,
  type Issue,
  type ModuleLookup,
  type ScanOptions,
} from './doctor-types.ts';

const mk = (
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

/** Module blocks with unknown module ids or props that fail the module's schema. */
export function checkModules(
  entries: readonly Entry[],
  getModule: (id: string) => ModuleLookup | undefined,
): Issue[] {
  const out: Issue[] = [];
  for (const e of entries) {
    if (e.corrupt || !e.key.startsWith('chapter/')) continue;
    const r = parseChapterDocument(e.data);
    if (!r.ok) continue;
    for (const b of r.value.blocks) {
      if (b.kind !== 'module') continue;
      const mod = getModule(b.moduleId);
      if (!mod) {
        out.push(
          mk(
            'unknown-module',
            e,
            'warning',
            'Unknown module',
            `Block uses “${b.moduleId}”, which this writer does not have.`,
            undefined,
            b.id,
          ),
        );
        continue;
      }
      const v = mod.validate(b.props);
      if (!v.ok) {
        out.push(
          mk(
            'bad-props',
            e,
            'warning',
            'Module settings are invalid',
            `${b.moduleId}: ${(v.errors ?? []).slice(0, 2).join('; ')}`,
            undefined,
            b.id,
          ),
        );
      }
    }
  }
  return out;
}

const SIDECAR_TARGET = /^(chapter|doc|novel|folder):(.+)$/;

/** Sidecars (meta / chapter-styles / publish / versions / growth) for items that no longer exist. */
export function checkSidecars(entries: readonly Entry[], tree: Tree): Issue[] {
  const ids = (prefix: string, at: number): Set<string> =>
    new Set(tree.byPrefix(prefix).map((e) => e.key.split('/')[at] ?? ''));
  const items = new Set([
    ...ids('novel/', 1),
    ...ids('chapter/', 3),
    ...ids('folder/', 1),
    ...ids('doc/', 1),
  ]);
  const styled = new Set([...ids('chapter/', 3), ...ids('doc/', 1)]);
  const out: Issue[] = [];
  for (const e of entries) {
    const orphan = (): void => {
      out.push(
        mk(
          'orphan-sidecar',
          e,
          'info',
          'Leftover data for a deleted item',
          'Nothing in the library uses this any more.',
          'remove-sidecar',
        ),
      );
    };
    if (e.key.startsWith('meta/item/')) {
      if (!items.has(e.key.slice(10))) orphan();
    } else if (e.key.startsWith('trash/')) {
      // A Trash record whose item is already gone (seasons count as items here).
      if (!items.has(e.key.slice(6)) && !ids('season/', 2).has(e.key.slice(6))) orphan();
    } else if (e.key.startsWith('meta/chapter-styles/')) {
      if (!styled.has(e.key.slice(20))) orphan();
    } else if (e.key.startsWith('meta/publish/')) {
      if (!ids('novel/', 1).has(e.key.slice(13))) orphan();
    } else if (e.key.startsWith('versions/') || e.key.startsWith('growth/')) {
      const m = SIDECAR_TARGET.exec(e.key.slice(e.key.indexOf('/') + 1));
      if (!m) continue;
      const pool =
        m[1] === 'chapter'
          ? ids('chapter/', 3)
          : m[1] === 'doc'
            ? ids('doc/', 1)
            : m[1] === 'novel'
              ? ids('novel/', 1)
              : ids('folder/', 1);
      if (!pool.has(m[2] ?? '')) orphan();
    }
  }
  return out;
}

async function brokenUri(uri: string, opts: ScanOptions): Promise<string | null> {
  if (!/^(data:|file:|https?:)/i.test(uri)) return 'Unsupported address';
  if (/^file:/i.test(uri) && opts.fileExists && !(await opts.fileExists(uri))) {
    return 'The file is missing from this device';
  }
  return null;
}

/** Cover art and custom font addresses that cannot be loaded. */
export async function checkUris(entries: readonly Entry[], opts: ScanOptions): Promise<Issue[]> {
  const out: Issue[] = [];
  for (const e of entries) {
    if (e.corrupt) continue;
    if (e.key.startsWith('meta/item/') && isRecord(e.data) && typeof e.data.coverUri === 'string') {
      const why = await brokenUri(e.data.coverUri, opts);
      if (why)
        out.push(mk('bad-cover', e, 'warning', 'Cover image cannot be loaded', why, 'clear-uri'));
    } else if (e.key === 'prefs/custom-fonts' && Array.isArray(e.data)) {
      for (const f of e.data) {
        if (!isRecord(f) || typeof f.uri !== 'string' || typeof f.id !== 'string') continue;
        const why = await brokenUri(f.uri, opts);
        if (why) {
          const name = typeof f.displayName === 'string' ? f.displayName : f.id;
          out.push(
            mk(
              'bad-font',
              e,
              'warning',
              `Custom font “${name}” cannot be loaded`,
              why,
              'clear-uri',
              f.id,
            ),
          );
        }
      }
    }
  }
  return out;
}
