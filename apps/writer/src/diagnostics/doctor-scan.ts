// Document Doctor: scans the raw key-value workspace for damage and orphans. Repairs live in
// doctor-repair.ts and ALWAYS quarantine the damaged raw value first. Pure TS (no React Native).
import { getWriterModule } from '../modules/registry.ts';
import { checkContent } from './doctor-checks.ts';
import {
  QUARANTINE,
  parseEntry,
  type Entry,
  type Issue,
  type RawKV,
  type ScanOptions,
  type ScanReport,
} from './doctor-types.ts';

export async function scanWorkspaceFull(kv: RawKV, opts: ScanOptions = {}): Promise<ScanReport> {
  const keys = (await kv.keys('')).filter((k) => !k.startsWith(QUARANTINE));
  const entries: Entry[] = [];
  for (const key of keys) {
    const raw = await kv.getRaw(key);
    if (raw !== null) entries.push(parseEntry(key, raw));
  }
  const issues: Issue[] = entries
    .filter((e) => e.corrupt)
    .map((e) => ({
      id: `corrupt:${e.key}`,
      key: e.key,
      severity: 'error',
      title: 'Unreadable data',
      detail: 'The stored value is not valid JSON.',
      repair: 'quarantine-remove',
    }));
  issues.push(
    ...(await checkContent(entries, { getModule: (id) => getWriterModule(id)?.schema, ...opts })),
  );
  return { issues, scanned: entries.length };
}

export async function scanWorkspace(kv: RawKV, opts: ScanOptions = {}): Promise<Issue[]> {
  return (await scanWorkspaceFull(kv, opts)).issues;
}
