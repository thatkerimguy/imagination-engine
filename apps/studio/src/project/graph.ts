import type { Block, LocalText, StoryProject } from '@ie/story';
import { allPassages, childLists } from './tree.ts';

export type EdgeVia = 'plain' | 'option' | 'branch' | 'success' | 'fail';

export interface FlowEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: 'jump' | 'call';
  readonly via: EdgeVia;
  /** The option text, when the jump sits inside a choice option. */
  readonly label: LocalText | null;
}

export interface FlowNode {
  readonly id: string;
  readonly column: number;
  readonly row: number;
  /** True when nothing leads here from the start. */
  readonly unreached: boolean;
}

export interface FlowGraph {
  readonly nodes: readonly FlowNode[];
  readonly edges: readonly FlowEdge[];
  readonly columns: number;
  readonly rows: number;
}

function collectEdges(passageId: string, blocks: readonly Block[]): FlowEdge[] {
  const edges: FlowEdge[] = [];
  const walk = (list: readonly Block[], via: EdgeVia, label: LocalText | null) => {
    for (const block of list) {
      if ((block.type === 'jump' || block.type === 'call') && block.to)
        edges.push({ from: passageId, to: block.to, kind: block.type, via, label });
      if (block.type === 'choice') {
        for (const option of block.options) walk(option.then, 'option', option.text);
        continue;
      }
      for (const [key, child] of childLists(block)) {
        const nested: EdgeVia = key.startsWith('s:')
          ? 'success'
          : key.startsWith('f:')
            ? 'fail'
            : 'branch';
        walk(child, via === 'plain' ? nested : via, label);
      }
    }
  };
  walk(blocks, 'plain', null);
  return edges;
}

/**
 * The story map: passages in columns by distance from the start (breadth first), in the order
 * they are reached. Passages nothing leads to go in a last column of their own.
 */
export function buildFlow(doc: StoryProject): FlowGraph {
  const passages = allPassages(doc);
  const ids = new Set(passages.map((p) => p.id));
  const edges = passages.flatMap((p) => collectEdges(p.id, p.blocks)).filter((e) => ids.has(e.to));
  const out = new Map<string, string[]>();
  for (const e of edges) out.set(e.from, [...(out.get(e.from) ?? []), e.to]);

  const column = new Map<string, number>();
  const queue = ids.has(doc.start) ? [doc.start] : [];
  if (queue.length) column.set(doc.start, 0);
  while (queue.length) {
    const id = queue.shift() as string;
    for (const next of out.get(id) ?? []) {
      if (column.has(next)) continue;
      column.set(next, (column.get(id) ?? 0) + 1);
      queue.push(next);
    }
  }
  const reachedColumns = column.size ? Math.max(...column.values()) + 1 : 0;
  const rowsUsed: number[] = [];
  const nodes = [
    ...column.keys(),
    ...passages.map((p) => p.id).filter((id) => !column.has(id)),
  ].map((id) => {
    const unreached = !column.has(id);
    const col = unreached ? reachedColumns : (column.get(id) ?? 0);
    const row = rowsUsed[col] ?? 0;
    rowsUsed[col] = row + 1;
    return { id, column: col, row, unreached };
  });
  return {
    nodes,
    edges,
    columns: rowsUsed.length,
    rows: Math.max(0, ...rowsUsed),
  };
}
