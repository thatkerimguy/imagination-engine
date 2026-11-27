// Document Doctor checks for the node tree and chapter bodies: parent / book references, kinds,
// cycles, invalid blocks, unknown gimmick modules and bad module props.
import { parseChapterDocument, type ModuleBlock, type NodeRecord } from '@kn/core';
import { guardBlueprint, resolveBlueprintProps } from '@kn/core/gimmicks';
import { starterBlueprint } from '@kn/engines/blueprints';
import { toChapter } from '../store/node-mapping.ts';
import { mk, type Issue, type ModuleLookup, type Tables } from './doctor-types.ts';

const PARENT_KIND: Partial<Record<NodeRecord['kind'], NodeRecord['kind']>> = {
  season: 'book',
  chapter: 'season',
};

/** Broken parent / book references, wrong parent kinds and cycles. */
export function checkStructure(t: Tables): Issue[] {
  const byId = new Map(t.nodes.map((n) => [n.id, n]));
  const out: Issue[] = [];
  const bad = (n: NodeRecord, detail: string): void => {
    out.push(mk('broken-tree', `node/${n.id}`, 'error', 'Misplaced item', detail));
  };
  for (const n of t.nodes) {
    const parent = n.parentId === null ? null : byId.get(n.parentId);
    const wantKind = PARENT_KIND[n.kind];
    if (n.parentId !== null && !parent) bad(n, 'Its parent no longer exists.');
    else if (n.kind === 'book' && n.parentId !== null) bad(n, 'A book must be at the top level.');
    else if (wantKind && parent?.kind !== wantKind)
      bad(n, `A ${n.kind} must sit inside a ${wantKind}.`);
    else if (n.bookId !== null && byId.get(n.bookId)?.kind !== 'book')
      bad(n, 'It points at a book that does not exist.');
    else if (wantKind && n.bookId !== (parent?.bookId ?? parent?.id))
      bad(n, 'It belongs to a different book than its parent.');
    let at: string | null = n.parentId;
    for (let hops = 0; at !== null && hops <= t.nodes.length; hops++) {
      if (at === n.id) {
        bad(n, 'It is part of a loop.');
        break;
      }
      at = byId.get(at)?.parentId ?? null;
    }
  }
  return out;
}

/** Bodies that are not valid block lists, unknown modules and invalid module props. */
export function checkBodies(
  t: Tables,
  getModule: (id: string) => ModuleLookup | undefined,
): Issue[] {
  const byId = new Map(t.nodes.map((n) => [n.id, n]));
  const out: Issue[] = [];
  for (const body of t.nodeBodies) {
    const node = byId.get(body.nodeId);
    if (!node) continue;
    const key = `node/${node.id}`;
    const invalid = (why: string): void => {
      out.push(mk('invalid-body', key, 'error', 'Text cannot be read', why));
    };
    let blocks: unknown;
    try {
      blocks = JSON.parse(body.blocksJson);
    } catch {
      invalid('The stored text is not valid JSON.');
      continue;
    }
    if (!Array.isArray(blocks)) {
      invalid('The stored text is not a list of blocks.');
      continue;
    }
    if (node.kind !== 'chapter') continue;
    const r = parseChapterDocument(toChapter(node, body));
    if (!r.ok) {
      invalid(r.errors.slice(0, 2).join('; '));
      continue;
    }
    for (const b of r.value.blocks) {
      if (b.kind !== 'module') continue;
      if (typeof b.props.blueprintId === 'string') {
        out.push(...checkCue(b, key, r.value.blueprints));
        continue;
      }
      const mod = getModule(b.moduleId);
      if (!mod) {
        const detail = `Block uses “${b.moduleId}”, which this writer does not have.`;
        out.push(mk('unknown-module', key, 'warning', 'Unknown module', detail, undefined, b.id));
        continue;
      }
      const v = mod.validate(b.props);
      if (!v.ok) {
        const detail = `${b.moduleId}: ${(v.errors ?? []).slice(0, 2).join('; ')}`;
        out.push(
          mk('bad-props', key, 'warning', 'Module settings are invalid', detail, undefined, b.id),
        );
      }
    }
  }
  return out;
}

/** A v2 cue: its blueprint must resolve (inline copy or starter) and its props must validate. */
function checkCue(b: ModuleBlock, key: string, inline?: Record<string, unknown>): Issue[] {
  const id = String(b.props.blueprintId);
  const own = inline?.[id];
  const g = own === undefined ? null : guardBlueprint(own);
  const bp = g?.ok ? g.blueprint : starterBlueprint(id);
  if (!bp) {
    const detail = `Cue uses gimmick “${id}”, which this writer does not have.`;
    return [mk('unknown-module', key, 'warning', 'Unknown module', detail, undefined, b.id)];
  }
  const props = { ...b.props };
  delete props.blueprintId;
  const v = resolveBlueprintProps(bp, props);
  if (v.ok) return [];
  const detail = `${bp.name}: ${v.errors.slice(0, 2).join('; ')}`;
  return [mk('bad-props', key, 'warning', 'Module settings are invalid', detail, undefined, b.id)];
}
