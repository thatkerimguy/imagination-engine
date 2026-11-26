// Row storage for the in-memory relational engine: one Map per table, plus the relational rules
// SQLite enforces for us natively (foreign keys on load, ON DELETE CASCADE) and the FTS mirror.
import type { MediaAssetRecord, NodeBodyRecord, NodeLinkRecord, NodeRecord } from '@kn/core';
import { MemorySearchIndex } from './memory-search.ts';
import type { DatabaseTables, GrowthLogRow, IntegrityCounts, SettingRow } from './port.ts';
import { cloneTables, linkKey, orderForInsert } from './rows.ts';

export class ForeignKeyError extends Error {
  constructor(detail: string) {
    super(`FOREIGN KEY constraint failed: ${detail}`);
    this.name = 'ForeignKeyError';
  }
}

export const copy = <T extends object>(v: T): T => ({ ...v });

export class MemoryStore {
  readonly nodes = new Map<string, NodeRecord>();
  readonly bodies = new Map<string, NodeBodyRecord>();
  readonly links = new Map<string, NodeLinkRecord>();
  readonly growth = new Map<string, GrowthLogRow>();
  readonly media = new Map<string, MediaAssetRecord>();
  readonly settings = new Map<string, SettingRow>();
  readonly fts = new MemorySearchIndex();
  gimmicks: Pick<DatabaseTables, 'gimmickPacks' | 'gimmickBlueprints'> = {
    gimmickPacks: [],
    gimmickBlueprints: [],
  };

  /** Mirrors FTS triggers: active nodes are indexed by title + body text, trashed ones are not. */
  syncFts(id: string): void {
    const n = this.nodes.get(id);
    if (!n || n.deletedAt) this.fts.remove(id);
    else this.fts.put(id, n.title, this.bodies.get(id)?.plainText ?? '');
  }

  /** Loads tables into an empty store, enforcing foreign keys. Throws on a broken parent. */
  load(t: DatabaseTables): void {
    for (const n of orderForInsert(t.nodes)) {
      if (n.parentId && !this.nodes.has(n.parentId)) throw new ForeignKeyError(`parent of ${n.id}`);
      this.nodes.set(n.id, copy(n));
    }
    const has = (id: string | null): boolean => !id || this.nodes.has(id);
    for (const m of t.mediaAssets) this.media.set(m.id, copy(m));
    for (const n of this.nodes.values())
      if (n.coverAssetId && !this.media.has(n.coverAssetId)) n.coverAssetId = null;
    for (const b of t.nodeBodies) if (has(b.nodeId)) this.bodies.set(b.nodeId, copy(b));
    for (const l of t.nodeLinks)
      if (has(l.sourceId) && has(l.targetId)) this.links.set(linkKey(l), copy(l));
    for (const g of t.growthLogs)
      if (has(g.nodeId) && has(g.bookId)) this.growth.set(g.id, copy(g));
    for (const s of t.settings) this.settings.set(s.key, copy(s));
    this.gimmicks = {
      gimmickPacks: t.gimmickPacks.map(copy),
      gimmickBlueprints: t.gimmickBlueprints.map(copy),
    };
    for (const id of this.nodes.keys()) this.syncFts(id);
  }

  clear(): void {
    for (const m of [this.nodes, this.bodies, this.links, this.growth, this.media, this.settings])
      m.clear();
    this.gimmicks = { gimmickPacks: [], gimmickBlueprints: [] };
    this.fts.clear();
  }

  /** ON DELETE CASCADE: removes the nodes, every descendant, and their bodies/links/growth. */
  cascadeDelete(ids: readonly string[]): Set<string> {
    const gone = new Set(ids.filter((id) => this.nodes.has(id)));
    const below = (n: NodeRecord): boolean =>
      (!!n.parentId && gone.has(n.parentId)) || (!!n.bookId && gone.has(n.bookId));
    for (let grew = gone.size > 0; grew;) {
      grew = false;
      for (const n of this.nodes.values())
        if (!gone.has(n.id) && below(n)) {
          gone.add(n.id);
          grew = true;
        }
    }
    for (const id of gone) {
      this.nodes.delete(id);
      this.bodies.delete(id);
      this.fts.remove(id);
    }
    for (const [k, l] of this.links)
      if (gone.has(l.sourceId) || gone.has(l.targetId)) this.links.delete(k);
    for (const [k, g] of this.growth)
      if (gone.has(g.nodeId) || (g.bookId && gone.has(g.bookId))) this.growth.delete(k);
    return gone;
  }

  export(): DatabaseTables {
    return cloneTables({
      nodes: orderForInsert([...this.nodes.values()]),
      nodeBodies: [...this.bodies.values()],
      nodeLinks: [...this.links.values()],
      growthLogs: [...this.growth.values()],
      mediaAssets: [...this.media.values()],
      settings: [...this.settings.values()],
      ...this.gimmicks,
    });
  }

  integrity(): IntegrityCounts {
    let activeNodes = 0;
    let brokenParents = 0;
    for (const n of this.nodes.values()) {
      if (!n.deletedAt) activeNodes++;
      if (n.parentId && !this.nodes.has(n.parentId)) brokenParents++;
    }
    const missing = (id: string): boolean => !this.nodes.has(id);
    const links = [...this.links.values()];
    return {
      ftsRows: this.fts.size,
      activeNodes,
      brokenParents,
      orphanBodies: [...this.bodies.keys()].filter(missing).length,
      orphanLinks: links.filter((l) => missing(l.sourceId) || missing(l.targetId)).length,
      orphanGrowth: [...this.growth.values()].filter((g) => missing(g.nodeId)).length,
    };
  }
}
