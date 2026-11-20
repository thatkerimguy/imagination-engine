// Version history (`versions/<targetId>`, target = `chapter:<id>` or `doc:<id>`): a rolling ring of
// 30 automatic checkpoints (at most one per 5 minutes of editing), unlimited named manual
// checkpoints, and a mandatory "Before restore" snapshot written before any restore.
import { ulid } from '@kn/core';
import type { NovelRepository } from './repository.ts';

export type VersionTarget = `chapter:${string}` | `doc:${string}`;
export type SnapshotKind = 'auto' | 'manual' | 'pre-restore';

export interface Snapshot {
  id: string;
  ts: number;
  label?: string;
  kind: SnapshotKind;
  wordCount: number;
  blocks: unknown[];
}

export interface VersionLog {
  snapshots: Snapshot[];
}

export const AUTO_CHECKPOINT_MS = 5 * 60 * 1000;
export const AUTO_RING_SIZE = 30;
/** Pre-restore snapshots are safety nets; keep a generous but bounded number. */
const PRE_RESTORE_KEEP = 10;

export const versionsKey = (target: VersionTarget): string => `versions/${target}`;

/** Words in prose / dialogue blocks of any block-shaped array. Pure. */
export function blocksWordCount(blocks: readonly unknown[]): number {
  let n = 0;
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    const text = (b as { text?: unknown }).text;
    if (typeof text === 'string') n += text.split(/\s+/).filter(Boolean).length;
  }
  return n;
}

const isSnapshot = (v: unknown): v is Snapshot => {
  const s = v as Partial<Snapshot> | null;
  return (
    !!s &&
    typeof s.id === 'string' &&
    typeof s.ts === 'number' &&
    (s.kind === 'auto' || s.kind === 'manual' || s.kind === 'pre-restore') &&
    Array.isArray(s.blocks)
  );
};

export async function loadVersions(
  repo: NovelRepository,
  target: VersionTarget,
): Promise<VersionLog> {
  const raw = (await repo.docs.read<unknown>(versionsKey(target)))?.data as
    { snapshots?: unknown } | undefined;
  const list = Array.isArray(raw?.snapshots) ? raw.snapshots.filter(isSnapshot) : [];
  return { snapshots: [...list].sort((a, b) => b.ts - a.ts) };
}

async function save(repo: NovelRepository, target: VersionTarget, log: VersionLog): Promise<void> {
  await repo.docs.write(versionsKey(target), log);
}

export function makeSnapshot(
  kind: SnapshotKind,
  blocks: readonly unknown[],
  ts: number,
  label?: string,
): Snapshot {
  const trimmed = label?.trim();
  return {
    id: ulid(ts),
    ts,
    kind,
    ...(trimmed ? { label: trimmed } : {}),
    wordCount: blocksWordCount(blocks),
    blocks: JSON.parse(JSON.stringify(blocks)) as unknown[],
  };
}

const sameBlocks = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Adds `snap` (newest first) and trims: 30 auto snapshots, 10 pre-restore, manual unlimited. Pure.
 */
export function addSnapshot(log: VersionLog, snap: Snapshot): VersionLog {
  const all = [snap, ...log.snapshots].sort((a, b) => b.ts - a.ts);
  let autos = 0;
  let pre = 0;
  return {
    snapshots: all.filter((s) => {
      if (s.kind === 'auto') return ++autos <= AUTO_RING_SIZE;
      if (s.kind === 'pre-restore') return ++pre <= PRE_RESTORE_KEEP;
      return true;
    }),
  };
}

/** Whether an automatic checkpoint is due: 5 minutes since the last one and the text changed. */
export function autoCheckpointDue(
  log: VersionLog,
  blocks: readonly unknown[],
  now: number,
): boolean {
  const lastAuto = log.snapshots.find((s) => s.kind === 'auto');
  if (lastAuto && now - lastAuto.ts < AUTO_CHECKPOINT_MS) return false;
  const newest = log.snapshots[0];
  return !newest || !sameBlocks(newest.blocks, blocks);
}

/** Records an automatic checkpoint if one is due. Returns whether it wrote one. */
export async function recordAutoCheckpoint(
  repo: NovelRepository,
  target: VersionTarget,
  blocks: readonly unknown[],
  now = Date.now(),
): Promise<boolean> {
  if (blocks.length === 0) return false;
  const log = await loadVersions(repo, target);
  if (!autoCheckpointDue(log, blocks, now)) return false;
  await save(repo, target, addSnapshot(log, makeSnapshot('auto', blocks, now)));
  return true;
}

/** Saves a named manual checkpoint (never rotated out). */
export async function saveManualCheckpoint(
  repo: NovelRepository,
  target: VersionTarget,
  blocks: readonly unknown[],
  label?: string,
  now = Date.now(),
): Promise<Snapshot> {
  const snap = makeSnapshot('manual', blocks, now, label);
  await save(repo, target, addSnapshot(await loadVersions(repo, target), snap));
  repo.notifyChanged();
  return snap;
}

/**
 * Writes the mandatory "Before restore" snapshot of `currentBlocks`, then returns the blocks of
 * `snapshotId` for the caller to apply to its draft (through its normal save path).
 */
export async function prepareRestore(
  repo: NovelRepository,
  target: VersionTarget,
  snapshotId: string,
  currentBlocks: readonly unknown[],
  now = Date.now(),
): Promise<unknown[]> {
  const log = await loadVersions(repo, target);
  const snap = log.snapshots.find((s) => s.id === snapshotId);
  if (!snap) throw new Error(`Snapshot ${snapshotId} not found`);
  const safety = makeSnapshot('pre-restore', currentBlocks, now, 'Before restore');
  await save(repo, target, addSnapshot(log, safety));
  repo.notifyChanged();
  return JSON.parse(JSON.stringify(snap.blocks)) as unknown[];
}

export async function deleteSnapshot(
  repo: NovelRepository,
  target: VersionTarget,
  snapshotId: string,
): Promise<void> {
  const log = await loadVersions(repo, target);
  await save(repo, target, { snapshots: log.snapshots.filter((s) => s.id !== snapshotId) });
  repo.notifyChanged();
}
