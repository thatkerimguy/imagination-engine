import { describe, expect, it } from 'vitest';
import {
  backupAge,
  buildRedactedDiagnosticReport,
  findingCodes,
  type DiagnosticInput,
} from './redact-report.ts';

const NOW = Date.parse('2026-11-26T15:00:00Z');
const input: DiagnosticInput = {
  appVersion: '0.1.0',
  platform: 'android',
  osVersion: 35,
  enabledModuleIds: ['bl-dice-3d', 'gits-cyberbrain-chat', 'bl-dice-3d', '<script>Snake Eyes'],
  knownModuleIds: ['bl-dice-3d', 'gits-cyberbrain-chat', 'core-ambient-bed'],
  counts: { novels: 2, chapters: 7, notes: 3, trashed: 1 },
  lastBackupAt: NOW - 5 * 3_600_000,
  externalBackupLinked: true,
  crashReportingEnabled: false,
  localCrashTypes: ['TypeError', 'TypeError', 'Error: My Secret Novel'],
  issues: [
    { key: 'growth/doc:01m8akgmamw9654y5p44p3hc1w', severity: 'info', repair: 'remove-sidecar' },
    { key: 'meta/item/vertical-slice', severity: 'warning', repair: 'clear-uri' },
    { key: 'meta/item/other', severity: 'warning', repair: 'clear-uri' },
  ],
  scanned: 11,
  now: NOW,
};

describe('buildRedactedDiagnosticReport', () => {
  const report = buildRedactedDiagnosticReport(input);

  it('reports versions, counts, modules, backup freshness, opt-in and finding codes', () => {
    expect(report).toContain('app: 0.1.0');
    expect(report).toContain('platform: android 35');
    expect(report).toContain('modules: bl-dice-3d, gits-cyberbrain-chat');
    expect(report).toContain('entities: novels=2 chapters=7 notes=3 trashed=1');
    expect(report).toContain('backup: last=5h external=linked');
    expect(report).toContain('crash reports: off');
    expect(report).toContain('local crashes: TypeError×2, Error×1');
    expect(report).toContain('  - warning clear-uri@meta ×2');
    expect(report).toContain('  - info remove-sidecar@growth ×1');
  });

  it('never leaks ids, titles, keys, URLs or unknown module names', () => {
    for (const leak of [
      '01m8akgm',
      'vertical-slice',
      'Snake Eyes',
      'Secret',
      'meta/item',
      'http',
      'growth/doc',
    ])
      expect(report).not.toContain(leak);
  });

  it('groups findings most severe first', () => {
    expect(findingCodes(input.issues).map((f) => f.severity)).toEqual(['warning', 'info']);
  });

  it('formats backup age', () => {
    expect(backupAge(null, NOW)).toBe('never');
    expect(backupAge(NOW - 60_000, NOW)).toBe('<1h');
    expect(backupAge(NOW - 3 * 86_400_000, NOW)).toBe('3d');
  });
});
