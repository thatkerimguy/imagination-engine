// Collects the (already non-identifying) facts the redacted Diagnostic Report needs: key counts,
// enabled module ids, backup freshness and opt-in state. Reads raw storage, never prose.
import { Platform } from 'react-native';
import { loadBackupSettings } from '../backup/backup-settings.ts';
import { writerModules } from '../modules/registry.ts';
import { APP_VERSION, crashReporter } from '../observability/reporter.ts';
import { loadSettings } from '../settings/app-settings.ts';
import type { NovelRepository } from '../store/repository.ts';
import type { RawKV } from './doctor-types.ts';
import type { DiagnosticInput } from './redact-report.ts';

function enabledModulesOf(raw: string | null): string[] {
  try {
    const m = (JSON.parse(raw ?? '') as { data?: { enabledModules?: unknown } }).data
      ?.enabledModules;
    return Array.isArray(m) ? m.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function collectDiagnosticInput(
  repo: NovelRepository,
  kv: RawKV,
  issues: DiagnosticInput['issues'],
  scanned: number,
  now = Date.now(),
): Promise<DiagnosticInput> {
  const novelKeys = await kv.keys('novel/');
  const modules: string[] = [];
  for (const k of novelKeys) modules.push(...enabledModulesOf(await kv.getRaw(k)));
  const [settings, backup] = await Promise.all([loadSettings(repo), loadBackupSettings(repo)]);
  return {
    appVersion: APP_VERSION,
    platform: Platform.OS,
    osVersion: Platform.Version,
    enabledModuleIds: modules,
    knownModuleIds: writerModules.map((m) => m.meta.id),
    counts: {
      novels: novelKeys.length,
      chapters: (await kv.keys('chapter/')).length,
      notes: (await kv.keys('doc/')).length,
      trashed: (await kv.keys('trash/')).length,
    },
    lastBackupAt: backup.lastBackupAt,
    externalBackupLinked: !!backup.safFolderUri,
    crashReportingEnabled: settings.crashReportingEnabled,
    localCrashTypes: crashReporter.ring.list().map((c) => c.type),
    issues,
    scanned,
    now,
  };
}
