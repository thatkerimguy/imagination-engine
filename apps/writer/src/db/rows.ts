// Small pure row helpers shared by every driver.
import type { NodeLinkRecord, NodeRecord } from '@kn/core';
import { emptyTables, type DatabaseTables } from './port.ts';

export const linkKey = (l: Pick<NodeLinkRecord, 'sourceId' | 'targetId' | 'relation'>): string =>
  `${l.sourceId}\u0000${l.targetId}\u0000${l.relation}`;

/** Deep copy of every table (missing tables become empty), so callers never share rows. */
export function cloneTables(t: Partial<DatabaseTables> = {}): DatabaseTables {
  const base = emptyTables();
  for (const k of Object.keys(base) as (keyof DatabaseTables)[]) {
    const rows = (t[k] ?? []) as object[];
    (base[k] as object[]) = rows.map((r) => ({ ...r }));
  }
  return base;
}

/**
 * Parents before children (so foreign keys hold during a replay). Nodes whose parent is not in
 * the list keep their relative order and come first. Cycle-safe: a loop is emitted as-is last.
 */
export function orderForInsert<T extends Pick<NodeRecord, 'id' | 'parentId'>>(
  nodes: readonly T[],
): T[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: T[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (n: T): void => {
    if (done.has(n.id) || visiting.has(n.id)) return;
    visiting.add(n.id);
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    if (parent) visit(parent);
    visiting.delete(n.id);
    done.add(n.id);
    out.push(n);
  };
  for (const n of nodes) visit(n);
  return out;
}
