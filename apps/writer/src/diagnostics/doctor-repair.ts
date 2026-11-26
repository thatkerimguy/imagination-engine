// Document Doctor repairs, all through `DatabasePort`. A damaged settings row is first copied to
// `quarantine/<key>` (never overwriting an earlier quarantine; backups skip those keys).
import type { NovelRepository } from '../store/repository.ts';
import { CUSTOM_FONTS_KEY } from './doctor-settings.ts';
import { scanWorkspace } from './doctor-scan.ts';
import { isRecord, QUARANTINE, type Issue, type ScanOptions } from './doctor-types.ts';

const settingKeyOf = (issueKey: string): string => issueKey.slice('setting/'.length);

/** Copies the raw settings value to `quarantine/<key>` (suffixed with a timestamp if taken). */
export async function quarantineSetting(
  repo: NovelRepository,
  key: string,
  now: number,
): Promise<void> {
  const raw = await repo.db.getSetting(key);
  if (raw === null) return;
  let target = `${QUARANTINE}${key}`;
  if ((await repo.db.getSetting(target)) !== null) target = `${target}#${now}`;
  await repo.db.setSetting(
    target,
    JSON.stringify({ data: { key, quarantinedAt: now, raw }, updatedAt: now }),
  );
}

async function clearUri(repo: NovelRepository, issue: Issue): Promise<boolean> {
  const { db } = repo;
  if (issue.key.startsWith('media/')) {
    await db.deleteMediaAssets([issue.key.slice('media/'.length)]);
    return true;
  }
  if (issue.key.startsWith('node/')) {
    const node = await db.getNode(issue.key.slice('node/'.length));
    if (node) await db.putNodes([{ node: { ...node, coverAssetId: null } }]);
    return true;
  }
  const key = settingKeyOf(issue.key);
  const raw = key === CUSTOM_FONTS_KEY ? await db.getSetting(key) : null;
  if (raw === null) return false;
  const env = JSON.parse(raw) as { data: unknown };
  if (!Array.isArray(env.data)) return false;
  env.data = env.data.filter((f) => !(isRecord(f) && f.id === issue.ref));
  await db.setSetting(key, JSON.stringify(env));
  return true;
}

async function apply(repo: NovelRepository, issue: Issue, now: number): Promise<boolean> {
  switch (issue.repair) {
    case 'rebuild-index':
      await repo.db.rebuildSearchIndex();
      return true;
    case 'remove-orphans': {
      const t = await repo.db.exportTables();
      const ids = new Set(t.nodes.map((n) => n.id));
      await repo.db.deleteGrowthLogs(
        t.growthLogs.filter((g) => !ids.has(g.nodeId)).map((g) => g.id),
      );
      return true;
    }
    case 'quarantine-remove':
    case 'remove-sidecar': {
      const key = settingKeyOf(issue.key);
      await quarantineSetting(repo, key, now);
      await repo.db.deleteSetting(key);
      return true;
    }
    case 'clear-uri':
      return clearUri(repo, issue);
    default:
      return false;
  }
}

export async function repairIssue(
  repo: NovelRepository,
  issue: Issue,
  opts: ScanOptions = {},
): Promise<boolean> {
  const ok = await apply(repo, issue, (opts.now ?? Date.now)());
  if (ok) repo.notifyChanged();
  return ok;
}

/** Repairs everything repairable, rescanning between passes. Returns how many repairs ran. */
export async function repairAll(repo: NovelRepository, opts: ScanOptions = {}): Promise<number> {
  let count = 0;
  for (let pass = 0; pass < 4; pass++) {
    const todo = (await scanWorkspace(repo, opts)).filter((i) => i.repair);
    if (todo.length === 0) break;
    for (const issue of todo) if (await repairIssue(repo, issue, opts)) count++;
  }
  return count;
}
