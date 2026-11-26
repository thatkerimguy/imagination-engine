// Document Doctor checks for cover media: assets whose file is missing on this device and
// nodes pointing at an asset that does not exist.
import { resolveMediaUri } from '../store/covers.ts';
import type { NovelRepository } from '../store/repository.ts';
import { mk, type Issue, type ScanOptions, type Tables } from './doctor-types.ts';

/** Why a stored address cannot be loaded, or null when it is fine (or cannot be checked). */
export async function brokenUri(uri: string, opts: ScanOptions): Promise<string | null> {
  if (!/^(data:|file:|https?:)/i.test(uri)) return 'Unsupported address';
  if (/^file:/i.test(uri) && opts.fileExists && !(await opts.fileExists(uri)))
    return 'The file is missing from this device';
  return null;
}

export async function checkMedia(
  repo: Pick<NovelRepository, 'mediaRoot'>,
  t: Tables,
  opts: ScanOptions,
): Promise<Issue[]> {
  const out: Issue[] = [];
  const ids = new Set(t.mediaAssets.map((a) => a.id));
  for (const a of t.mediaAssets) {
    if (a.kind === 'attachment') continue;
    const why = await brokenUri(resolveMediaUri(repo, a.relativePath), opts);
    if (why)
      out.push(
        mk(
          'bad-cover',
          `media/${a.id}`,
          'warning',
          'Cover image cannot be loaded',
          why,
          'clear-uri',
        ),
      );
  }
  for (const n of t.nodes) {
    if (n.coverAssetId && !ids.has(n.coverAssetId))
      out.push(
        mk(
          'missing-asset',
          `node/${n.id}`,
          'warning',
          'Cover image cannot be loaded',
          'The cover record is missing.',
          'clear-uri',
        ),
      );
  }
  return out;
}
