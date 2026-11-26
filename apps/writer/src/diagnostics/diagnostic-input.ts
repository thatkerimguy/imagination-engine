// Collects the (already non-identifying) facts the redacted Diagnostic Report needs: node counts,
// enabled module ids, backup freshness and opt-in state. Reads node rows, never prose.
import { Platform } from 'react-native';
import { loadBackupSettings } from '../backup/backup-settings.ts';
import { writerModules } from '../modules/registry.ts';
import { APP_VERSION, crashReporter } from '../observability/reporter.ts';
import { loadSettings } from '../settings/app-settings.ts';
import type { NovelManifest } from '@kn/core';
import { kindMeta } from '../store/node-mapping.ts';
import type { NovelRepository } from '../store/repository.ts';
import type { DiagnosticInput } from './redact-report.ts';

export async function collectDiagnosticInput(
  repo: NovelRepository,
  issues: DiagnosticInput['issues'],
  scanned: number,
  now = Date.now(),
): Promise<DiagnosticInput> {
  const nodes = await repo.db.listNodes({ includeDeleted: true });
  const active = nodes.filter((n) => !n.deletedAt);
  const count = (kind: string): number => active.filter((n) => n.kind === kind).length;
  const modules = active.flatMap(
    (n) =>
      (n.kind === 'book' ? kindMeta<Partial<NovelManifest>>(n.metaJson).enabledModules : []) ?? [],
  );
  const [settings, backup] = await Promise.all([loadSettings(repo), loadBackupSettings(repo)]);
  return {
    appVersion: APP_VERSION,
    platform: Platform.OS,
    osVersion: Platform.Version,
    enabledModuleIds: modules,
    knownModuleIds: writerModules.map((m) => m.meta.id),
    counts: {
      novels: count('book'),
      chapters: count('chapter'),
      notes: count('note'),
      trashed: nodes.length - active.length,
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
