// Shared types for Document Doctor: issues, scan options and small helpers. Pure TS.
import type { DatabaseTables } from '../db/port.ts';

export type Severity = 'error' | 'warning' | 'info';
export type RepairKind =
  | 'quarantine-remove' // a damaged settings row: quarantine it, then remove it
  | 'remove-sidecar' // a settings sidecar for an item that no longer exists
  | 'rebuild-index' // the search index disagrees with the nodes
  | 'remove-orphans' // growth rows whose node no longer exists
  | 'clear-uri'; // a cover asset / node cover / custom font that cannot be loaded

export interface Issue {
  id: string;
  /** Stable key: `node/<id>`, `media/<id>`, `fts`, `integrity/<table>`, `setting/<key>`. */
  key: string;
  severity: Severity;
  title: string;
  detail: string;
  repair?: RepairKind;
  /** The block id / font id an issue or repair refers to. */
  ref?: string;
}

export interface ModuleLookup {
  validate(props: unknown): { ok: boolean; errors?: string[] };
}

export interface ScanOptions {
  /** Whether a `file://` URI exists. Omit to skip file existence checks (web, tests). */
  fileExists?: (uri: string) => Promise<boolean>;
  /** Resolves a module id to its schema validator (defaults to the writer registry). */
  getModule?: (id: string) => ModuleLookup | undefined;
  now?: () => number;
}

export interface ScanReport {
  issues: Issue[];
  scanned: number;
}

export const QUARANTINE = 'quarantine/';

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** Builds an issue; the id is `<code>:<key>[:<ref>]`. */
export function mk(
  code: string,
  key: string,
  severity: Severity,
  title: string,
  detail: string,
  repair?: RepairKind,
  ref?: string,
): Issue {
  return {
    id: `${code}:${key}${ref ? `:${ref}` : ''}`,
    key,
    severity,
    title,
    detail,
    ...(repair ? { repair } : {}),
    ...(ref ? { ref } : {}),
  };
}

export type Tables = DatabaseTables;
