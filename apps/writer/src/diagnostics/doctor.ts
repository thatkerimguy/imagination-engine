// Document Doctor public surface: scan, repair, report. Pure TS (no React Native).
export { scanWorkspace, scanWorkspaceFull } from './doctor-scan.ts';
export { quarantineKey, repairAll, repairIssue } from './doctor-repair.ts';
export { formatReport, summaryLine } from './doctor-report.ts';
export { kvFromAdapter } from './doctor-types.ts';
export type {
  Issue,
  RawKV,
  RepairKind,
  ScanOptions,
  ScanReport,
  Severity,
} from './doctor-types.ts';
