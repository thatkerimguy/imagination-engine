// Document Doctor public surface: scan, repair, report. Pure TS (no React Native).
export { scanWorkspace, scanWorkspaceFull } from './doctor-scan.ts';
export { quarantineSetting, repairAll, repairIssue } from './doctor-repair.ts';
export { formatReport, summaryLine } from './doctor-report.ts';
export type { Issue, RepairKind, ScanOptions, ScanReport, Severity } from './doctor-types.ts';
