// Shared types for Document Doctor: raw key-value access, issues and parsed entries. Pure TS.
import type { StorageAdapter } from '../storage/types.ts';

export interface RawKV {
  keys(prefix: string): Promise<string[]>;
  getRaw(key: string): Promise<string | null>;
  set(key: string, raw: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const kvFromAdapter = (a: StorageAdapter): RawKV => ({
  keys: (prefix) => a.keys(prefix),
  getRaw: (key) => a.get(key),
  set: (key, raw) => a.set(key, raw),
  remove: (key) => a.remove(key),
});

export type Severity = 'error' | 'warning' | 'info';
export type RepairKind =
  | 'quarantine-remove' // damaged value: quarantine it, remove it from the live tree
  | 'drop-link' // a parent list names a missing child: drop that id
  | 'attach' // an orphan child is missing from its parent's list: append it
  | 'move-root' // a folder / note whose parent folder is missing: move to the root
  | 'remove-sidecar' // metadata for an item that no longer exists
  | 'clear-uri'; // broken cover / font address

export interface Issue {
  id: string;
  key: string;
  severity: Severity;
  title: string;
  detail: string;
  repair?: RepairKind;
  /** The child id / font id a repair acts on. */
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

export interface Entry {
  key: string;
  raw: string;
  /** The `data` field of the stored `{ data, updatedAt }` envelope (undefined when corrupt). */
  data?: unknown;
  corrupt: boolean;
}

export interface ScanReport {
  issues: Issue[];
  scanned: number;
}

export const QUARANTINE = 'quarantine/';

export function parseEntry(key: string, raw: string): Entry {
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v) && 'data' in v) {
      return { key, raw, data: (v as { data: unknown }).data, corrupt: false };
    }
  } catch {
    // corrupt
  }
  return { key, raw, corrupt: true };
}

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
