/*
 * Three-way merge of JSON documents (ADR 0024): what changed on one side since the common base is
 * kept, what changed on both is merged deeper, and a value changed differently on both sides is a
 * conflict settled by `prefer`. Lists of objects with string `id`s merge by id, so two devices that
 * each add, edit or remove different passages, blocks or tracks keep all of it.
 */

export type Json =
  null | boolean | number | string | readonly Json[] | { readonly [k: string]: Json };

export interface MergeResult<T> {
  readonly value: T;
  /** Paths where both sides changed the same value differently. */
  readonly conflicts: readonly string[];
}

type Obj = Readonly<Record<string, unknown>>;
type WithId = Obj & { readonly id: string };

const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const hasId = (v: unknown): v is WithId => isObject(v) && typeof v.id === 'string';
const isIdList = (v: unknown): v is readonly WithId[] => Array.isArray(v) && v.every(hasId);

export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((x, i) => jsonEqual(x, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    return ka.length === kb.length && ka.every((k) => jsonEqual(a[k], b[k]));
  }
  return false;
}

export function merge3<T>(
  base: T | undefined,
  ours: T,
  theirs: T,
  prefer: 'ours' | 'theirs' = 'ours',
): MergeResult<T> {
  const conflicts: string[] = [];
  const value = mergeValue(base, ours, theirs, '', prefer, conflicts) as T;
  return { value, conflicts };
}

function mergeValue(
  base: unknown,
  ours: unknown,
  theirs: unknown,
  path: string,
  prefer: 'ours' | 'theirs',
  conflicts: string[],
): unknown {
  if (jsonEqual(ours, theirs)) return ours;
  if (jsonEqual(ours, base)) return theirs;
  if (jsonEqual(theirs, base)) return ours;
  if (isObject(ours) && isObject(theirs)) {
    return mergeObject(isObject(base) ? base : {}, ours, theirs, path, prefer, conflicts);
  }
  if (isIdList(ours) && isIdList(theirs)) {
    return mergeList(isIdList(base) ? base : [], ours, theirs, path, prefer, conflicts);
  }
  conflicts.push(path || '/');
  return prefer === 'ours' ? ours : theirs;
}

function mergeObject(
  base: Obj,
  ours: Obj,
  theirs: Obj,
  path: string,
  prefer: 'ours' | 'theirs',
  conflicts: string[],
): Obj {
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(ours), ...Object.keys(theirs), ...Object.keys(base)]);
  let same = true;
  for (const key of keys) {
    const merged = mergeValue(
      base[key],
      ours[key],
      theirs[key],
      `${path}/${key}`,
      prefer,
      conflicts,
    );
    if (merged !== ours[key]) same = false;
    if (merged !== undefined) out[key] = merged;
  }
  // Keep the object itself when nothing in it changed, so unchanged parts stay shared.
  return same ? ours : out;
}

function mergeList(
  base: readonly WithId[],
  ours: readonly WithId[],
  theirs: readonly WithId[],
  path: string,
  prefer: 'ours' | 'theirs',
  conflicts: string[],
): WithId[] {
  const baseById = new Map(base.map((x) => [x.id, x]));
  const oursById = new Map(ours.map((x) => [x.id, x]));
  const theirsById = new Map(theirs.map((x) => [x.id, x]));
  const at = (id: string) => `${path}[${id}]`;

  /** An item one side removed stays only if the other side changed it meanwhile. */
  const keep = (id: string): WithId | undefined => {
    const b = baseById.get(id);
    const o = oursById.get(id);
    const t = theirsById.get(id);
    if (o && t) return mergeValue(b, o, t, at(id), prefer, conflicts) as WithId;
    const present = o ?? t;
    if (!present) return undefined;
    if (!b) return present; // added on one side
    return jsonEqual(present, b) ? undefined : present; // removed on the other side
  };

  const out: WithId[] = [];
  const placed = new Set<string>();
  for (const item of ours) {
    const merged = keep(item.id);
    placed.add(item.id);
    if (merged) out.push(merged);
  }
  // Their items not placed yet go after the nearest item that comes before them in their list.
  theirs.forEach((item, index) => {
    if (placed.has(item.id)) return;
    placed.add(item.id);
    const merged = keep(item.id);
    if (!merged) return;
    // Without a placed neighbour before it, it goes last.
    let position = out.length;
    for (let i = index - 1; i >= 0; i--) {
      const before = out.findIndex((x) => x.id === theirs[i]!.id);
      if (before >= 0) {
        position = before + 1;
        break;
      }
    }
    out.splice(position, 0, merged);
  });
  return out;
}
