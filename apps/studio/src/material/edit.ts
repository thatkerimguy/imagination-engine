import { createId } from '@ie/core';
import { materialTemplate } from '@ie/material';
import {
  MATERIAL_LIMITS,
  type Label,
  type MaterialDef,
  type MaterialDomain,
  type MaterialLink,
  type MaterialNode,
  type MaterialNodeType,
  type MaterialParam,
  type MaterialValue,
  type StoryProject,
} from '@ie/story';

/*
 * Pure edits on material graphs (ADR 0020). The Materials view calls these through the project
 * store, so each is one undoable step (drags merge into one).
 */

export function newMaterial(domain: MaterialDomain, name: Label): MaterialDef {
  return materialTemplate(domain, name, createId);
}

export function updateMaterial(
  doc: StoryProject,
  id: string,
  change: (material: MaterialDef) => MaterialDef,
): StoryProject {
  const list = doc.materials ?? [];
  const index = list.findIndex((m) => m.id === id);
  const current = list[index];
  if (!current) return doc;
  const next = change(current);
  if (next === current) return doc;
  return { ...doc, materials: list.map((m, i) => (i === index ? next : m)) };
}

function mapNode(
  def: MaterialDef,
  id: string,
  change: (node: MaterialNode) => MaterialNode,
): MaterialDef {
  let changed = false;
  const nodes = def.nodes.map((n) => {
    if (n.id !== id) return n;
    const next = change(n);
    if (next !== n) changed = true;
    return next;
  });
  return changed ? { ...def, nodes } : def;
}

const clampCoord = (v: number) => Math.round(Math.min(MATERIAL_LIMITS.canvas, Math.max(0, v)));

/** Adds a node at (x, y); a param node reads the first parameter. Returns the graph and its id. */
export function addNode(
  def: MaterialDef,
  type: MaterialNodeType,
  x: number,
  y: number,
): { material: MaterialDef; id: string | null } {
  if (def.nodes.length >= MATERIAL_LIMITS.nodes) return { material: def, id: null };
  if (type === 'output' && def.nodes.some((n) => n.type === 'output'))
    return { material: def, id: null };
  const id = createId('mn');
  const param = type === 'param' ? def.params[0]?.id : undefined;
  const node: MaterialNode = {
    id,
    type,
    x: clampCoord(x),
    y: clampCoord(y),
    ...(param ? { param } : {}),
  };
  return { material: { ...def, nodes: [...def.nodes, node] }, id };
}

/** Removes a node and every link that read it. The output node stays. */
export function removeNode(def: MaterialDef, id: string): MaterialDef {
  const node = def.nodes.find((n) => n.id === id);
  if (!node || node.type === 'output') return def;
  const nodes = def.nodes
    .filter((n) => n.id !== id)
    .map((n) => {
      if (!n.inputs || !Object.values(n.inputs).some((l) => l.node === id)) return n;
      const inputs = Object.fromEntries(Object.entries(n.inputs).filter(([, l]) => l.node !== id));
      return { ...n, inputs };
    });
  return { ...def, nodes };
}

export function moveNode(def: MaterialDef, id: string, x: number, y: number): MaterialDef {
  const nx = clampCoord(x);
  const ny = clampCoord(y);
  return mapNode(def, id, (n) => (n.x === nx && n.y === ny ? n : { ...n, x: nx, y: ny }));
}

/** True when `from` reads `target`, directly or through other nodes. */
export function dependsOn(def: MaterialDef, from: string, target: string): boolean {
  const byId = new Map(def.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length > 0) {
    const id = stack.pop() ?? '';
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const link of Object.values(byId.get(id)?.inputs ?? {})) stack.push(link.node);
  }
  return false;
}

/**
 * Links an output to an input (tap to connect). It replaces what the input read before. A link
 * that would make a loop, or join a node to itself, is refused: the graph comes back unchanged.
 */
export function link(
  def: MaterialDef,
  from: { node: string; port: string },
  to: { node: string; port: string },
): MaterialDef {
  if (from.node === to.node || dependsOn(def, from.node, to.node)) return def;
  if (!def.nodes.some((n) => n.id === from.node)) return def;
  const value: MaterialLink = { node: from.node, port: from.port };
  return mapNode(def, to.node, (n) => ({ ...n, inputs: { ...n.inputs, [to.port]: value } }));
}

export function unlink(def: MaterialDef, node: string, port: string): MaterialDef {
  return mapNode(def, node, (n) => {
    if (!n.inputs?.[port]) return n;
    const inputs = Object.fromEntries(Object.entries(n.inputs).filter(([k]) => k !== port));
    return { ...n, inputs };
  });
}

export function setValue(
  def: MaterialDef,
  node: string,
  port: string,
  value: MaterialValue,
): MaterialDef {
  return mapNode(def, node, (n) => ({ ...n, values: { ...n.values, [port]: value } }));
}

export function setNodeParam(def: MaterialDef, node: string, param: string): MaterialDef {
  return mapNode(def, node, (n) => (n.param === param ? n : { ...n, param }));
}

export function addParam(def: MaterialDef, name: Label): { material: MaterialDef; id: string | null } {
  if (def.params.length >= MATERIAL_LIMITS.params) return { material: def, id: null };
  const id = createId('mp');
  const param: MaterialParam = { id, name, default: 0.5, min: 0, max: 1 };
  return { material: { ...def, params: [...def.params, param] }, id };
}

/** Changes a parameter, keeping min ≤ default ≤ max whichever field moved. */
export function updateParam(
  def: MaterialDef,
  id: string,
  patch: Partial<Omit<MaterialParam, 'id'>>,
): MaterialDef {
  return {
    ...def,
    params: def.params.map((p) => {
      if (p.id !== id) return p;
      const next = { ...p, ...patch };
      const min = Math.min(next.min, next.max);
      const max = Math.max(next.min, next.max);
      return { ...next, min, max, default: Math.min(max, Math.max(min, next.default)) };
    }),
  };
}

/** Removes a parameter; nodes that read it read nothing until another is picked. */
export function removeParam(def: MaterialDef, id: string): MaterialDef {
  return {
    ...def,
    params: def.params.filter((p) => p.id !== id),
    nodes: def.nodes.map((n) => {
      if (n.param !== id) return n;
      const { param: _drop, ...rest } = n;
      return rest;
    }),
  };
}
