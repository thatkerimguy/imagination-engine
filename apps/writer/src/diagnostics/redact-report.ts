// Redacted Diagnostic Report: what support needs to understand a problem, and nothing else.
// Strictly zero prose, titles, URLs, tokens, ids, cover filenames or storage keys — only versions,
// counts, enabled module ids (from the known registry), backup freshness, the crash opt-in state
// and Document Doctor finding codes / severities. Pure.
import type { Issue, Severity } from './doctor-types.ts';

export interface DiagnosticInput {
  appVersion: string;
  platform: string;
  osVersion?: string | number;
  enabledModuleIds: readonly string[];
  /** Module ids the app ships; anything else is dropped. */
  knownModuleIds: readonly string[];
  counts: { novels: number; chapters: number; notes: number; trashed: number };
  lastBackupAt: number | null;
  externalBackupLinked: boolean;
  crashReportingEnabled: boolean;
  localCrashTypes: readonly string[];
  issues: readonly Pick<Issue, 'key' | 'severity' | 'repair'>[];
  scanned: number;
  now: number;
}

export interface FindingCode {
  code: string;
  severity: Severity;
  count: number;
}

const SAFE = /^[A-Za-z0-9._-]{1,40}$/;
const safe = (v: unknown, fallback = 'unknown'): string =>
  typeof v === 'string' && SAFE.test(v) ? v : typeof v === 'number' ? String(v) : fallback;
const int = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** `remove-sidecar@growth`: the repair kind and the storage area, never the key itself. */
export function findingCode(issue: Pick<Issue, 'key' | 'repair'>): string {
  const area = issue.key.split('/')[0] ?? '';
  return `${issue.repair ?? 'report'}@${/^[a-z-]{1,20}$/.test(area) ? area : 'other'}`;
}

/** Groups findings by code + severity, most severe first. */
export function findingCodes(issues: DiagnosticInput['issues']): FindingCode[] {
  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  const map = new Map<string, FindingCode>();
  for (const i of issues) {
    const code = findingCode(i);
    const id = `${i.severity}|${code}`;
    const hit = map.get(id);
    if (hit) hit.count += 1;
    else map.set(id, { code, severity: i.severity, count: 1 });
  }
  return [...map.values()].sort(
    (a, b) => order[a.severity] - order[b.severity] || a.code.localeCompare(b.code),
  );
}

/** "3h", "2d", "never". */
export function backupAge(lastBackupAt: number | null, now: number): string {
  if (!lastBackupAt || lastBackupAt > now) return lastBackupAt ? 'just now' : 'never';
  const h = Math.floor((now - lastBackupAt) / 3_600_000);
  return h < 1 ? '<1h' : h < 48 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

export function buildRedactedDiagnosticReport(input: DiagnosticInput): string {
  const known = new Set(input.knownModuleIds);
  const modules = [...new Set(input.enabledModuleIds)].filter((m) => known.has(m)).sort();
  const c = input.counts;
  const crashes = new Map<string, number>();
  for (const t of input.localCrashTypes) {
    const k = safe(t, 'Error');
    crashes.set(k, (crashes.get(k) ?? 0) + 1);
  }
  const findings = findingCodes(input.issues);
  const lines = [
    'Kinetic Writer — redacted diagnostic report',
    'Contains no writing, titles, notes, links, ids or tokens.',
    '',
    `app: ${safe(input.appVersion)}`,
    `platform: ${safe(input.platform)} ${safe(input.osVersion, '')}`.trimEnd(),
    `generated: ${new Date(input.now).toISOString().slice(0, 13)}:00Z`,
    `modules: ${modules.length ? modules.join(', ') : 'none'}`,
    `entities: novels=${int(c.novels)} chapters=${int(c.chapters)} notes=${int(c.notes)} trashed=${int(c.trashed)}`,
    `backup: last=${backupAge(input.lastBackupAt, input.now)} external=${input.externalBackupLinked ? 'linked' : 'none'}`,
    `crash reports: ${input.crashReportingEnabled ? 'opted in' : 'off'}`,
    `local crashes: ${crashes.size ? [...crashes].map(([t, n]) => `${t}×${n}`).join(', ') : 'none'}`,
    `doctor: ${input.issues.length} finding(s) in ${int(input.scanned)} entries`,
    ...findings.map((f) => `  - ${f.severity} ${f.code} ×${f.count}`),
  ];
  return lines.join('\n');
}
