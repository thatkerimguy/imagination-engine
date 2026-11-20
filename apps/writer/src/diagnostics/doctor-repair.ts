// Document Doctor repairs. Every repair first copies the damaged raw value to
// `quarantine/<key>` (never overwriting an earlier quarantine), then fixes links safely.
import { scanWorkspace } from './doctor-scan.ts';
import {
  QUARANTINE,
  isRecord,
  parseEntry,
  type Issue,
  type RawKV,
  type ScanOptions,
} from './doctor-types.ts';

export interface RepairContext {
  now: () => number;
  /** Keys already quarantined during this repair run. */
  quarantined: Set<string>;
}

const newContext = (opts: ScanOptions): RepairContext => ({
  now: opts.now ?? Date.now,
  quarantined: new Set(),
});

/** Copies the raw value to `quarantine/<key>` (suffixed with a timestamp if taken). */
export async function quarantineKey(kv: RawKV, key: string, ctx: RepairContext): Promise<void> {
  if (ctx.quarantined.has(key)) return;
  const raw = await kv.getRaw(key);
  if (raw === null) return;
  const ts = ctx.now();
  let target = `${QUARANTINE}${key}`;
  if ((await kv.getRaw(target)) !== null) target = `${target}#${ts}`;
  await kv.set(target, JSON.stringify({ data: { key, quarantinedAt: ts, raw }, updatedAt: ts }));
  ctx.quarantined.add(key);
}

/** Edits the `data` of a stored envelope in place (keeping `updatedAt`). */
async function mutate(
  kv: RawKV,
  key: string,
  edit: (data: Record<string, unknown>) => void,
): Promise<void> {
  const raw = await kv.getRaw(key);
  if (raw === null) return;
  const e = parseEntry(key, raw);
  if (e.corrupt || !isRecord(e.data)) return;
  const envelope = JSON.parse(raw) as { data: Record<string, unknown> };
  edit(envelope.data);
  await kv.set(key, JSON.stringify(envelope));
}

const listOf = (data: Record<string, unknown>, field: string): string[] =>
  Array.isArray(data[field])
    ? (data[field] as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

/** The key of the list an orphan season / chapter should be re-attached to. */
function parentOf(key: string): { key: string; field: string } | null {
  const [kind, a, b] = key.split('/');
  if (kind === 'season' && a) return { key: `novel/${a}`, field: 'seasons' };
  if (kind === 'chapter' && a && b) return { key: `season/${a}/${b}`, field: 'chapters' };
  return null;
}

export async function repairIssue(
  kv: RawKV,
  issue: Issue,
  opts: ScanOptions = {},
  ctx: RepairContext = newContext(opts),
): Promise<boolean> {
  const { key, ref } = issue;
  switch (issue.repair) {
    case 'quarantine-remove':
    case 'remove-sidecar':
      await quarantineKey(kv, key, ctx);
      await kv.remove(key);
      return true;
    case 'drop-link':
      await quarantineKey(kv, key, ctx);
      await mutate(kv, key, (d) => {
        const field = key.startsWith('novel/') ? 'seasons' : 'chapters';
        d[field] = listOf(d, field).filter((id) => id !== ref);
      });
      return true;
    case 'attach': {
      const parent = parentOf(key);
      if (!parent || !ref) return false;
      await quarantineKey(kv, parent.key, ctx);
      await mutate(kv, parent.key, (d) => {
        const list = listOf(d, parent.field);
        if (!list.includes(ref)) d[parent.field] = [...list, ref];
      });
      return true;
    }
    case 'move-root':
      await quarantineKey(kv, key, ctx);
      await mutate(kv, key, (d) => {
        d.parentFolderId = null;
      });
      return true;
    case 'clear-uri':
      await quarantineKey(kv, key, ctx);
      if (key === 'prefs/custom-fonts') {
        const raw = await kv.getRaw(key);
        const env = raw ? (JSON.parse(raw) as { data: unknown }) : null;
        if (env && Array.isArray(env.data)) {
          env.data = env.data.filter((f) => !(isRecord(f) && f.id === ref));
          await kv.set(key, JSON.stringify(env));
        }
      } else {
        await mutate(kv, key, (d) => {
          delete d.coverUri;
        });
      }
      return true;
    default:
      return false;
  }
}

/**
 * Repairs everything repairable, rescanning between passes (fixing one link can reveal the next,
 * e.g. a removed chapter leaving a dangling list entry). Returns how many repairs ran.
 */
export async function repairAll(kv: RawKV, opts: ScanOptions = {}): Promise<number> {
  const ctx = newContext(opts);
  let count = 0;
  for (let pass = 0; pass < 6; pass++) {
    const todo = (await scanWorkspace(kv, opts)).filter((i) => i.repair);
    if (todo.length === 0) break;
    for (const issue of todo) if (await repairIssue(kv, issue, opts, ctx)) count++;
  }
  return count;
}
