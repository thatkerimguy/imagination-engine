// Plain-text diagnostics report (for sharing / copying). Pure.
import type { Issue } from './doctor-types.ts';

export function summaryLine(issues: readonly Issue[], scanned: number): string {
  const n = issues.length;
  return `${n === 0 ? 'No issues' : `${n} issue${n === 1 ? '' : 's'}`} · scanned ${scanned} entries`;
}

export function formatReport(issues: readonly Issue[], scanned: number, now = new Date()): string {
  const lines = [`Document Doctor report — ${now.toISOString()}`, summaryLine(issues, scanned), ''];
  for (const i of issues) {
    lines.push(`[${i.severity.toUpperCase()}] ${i.title}`, `  ${i.detail}`, `  key: ${i.key}`);
  }
  return lines.join('\n');
}
