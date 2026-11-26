// Document Doctor: scans the relational workspace (`DatabasePort` tables + integrity counts) for
// damage and orphans. Repairs live in doctor-repair.ts. Pure TS (no React Native).
import { getWriterModule } from '../modules/registry.ts';
import type { NovelRepository } from '../store/repository.ts';
import { checkMedia } from './doctor-media.ts';
import { checkBodies, checkStructure } from './doctor-nodes.ts';
import { checkSettings } from './doctor-settings.ts';
import { mk, type Issue, type ScanOptions, type ScanReport } from './doctor-types.ts';

async function checkIntegrity(repo: NovelRepository): Promise<Issue[]> {
  const ig = await repo.db.integrity();
  const out: Issue[] = [];
  if (ig.ftsRows !== ig.activeNodes)
    out.push(
      mk(
        'fts',
        'fts',
        'warning',
        'Search index is out of date',
        `The index holds ${ig.ftsRows} entries for ${ig.activeNodes} items.`,
        'rebuild-index',
      ),
    );
  const orphans: [string, number, Issue['repair']][] = [
    ['node_bodies', ig.orphanBodies, undefined],
    ['node_links', ig.orphanLinks, undefined],
    ['growth_logs', ig.orphanGrowth, 'remove-orphans'],
  ];
  for (const [table, n, repair] of orphans)
    if (n > 0)
      out.push(
        mk(
          'orphans',
          `integrity/${table}`,
          'error',
          'Leftover rows',
          `${n} row(s) in ${table} belong to nothing.`,
          repair,
        ),
      );
  return out;
}

export async function scanWorkspaceFull(
  repo: NovelRepository,
  opts: ScanOptions = {},
): Promise<ScanReport> {
  const t = await repo.db.exportTables();
  const getModule = opts.getModule ?? ((id: string) => getWriterModule(id)?.schema);
  const issues: Issue[] = [
    ...checkStructure(t),
    ...checkBodies(t, getModule),
    ...(await checkMedia(repo, t, opts)),
    ...(await checkSettings(t, opts)),
    ...(await checkIntegrity(repo)),
  ];
  return { issues, scanned: t.nodes.length + t.mediaAssets.length + t.settings.length };
}

export async function scanWorkspace(
  repo: NovelRepository,
  opts: ScanOptions = {},
): Promise<Issue[]> {
  return (await scanWorkspaceFull(repo, opts)).issues;
}
