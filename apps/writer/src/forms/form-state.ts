// Pure draft logic for the schema-driven gimmick form. No react / react-native imports so it
// runs under plain node in unit tests.
import { fillDefaults, isFieldVisible } from '@kn/core';
import type { FieldDescriptor, ModuleSchemaDefinition } from '@kn/core';

export type Draft = Record<string, unknown>;
type Schema = ModuleSchemaDefinition<Record<string, unknown>>;

export interface DraftValidation {
  valid: boolean;
  props?: Record<string, unknown>;
  /** Display messages (key prefix stripped) per visible field key. */
  byField: Record<string, string[]>;
  /** Messages that do not belong to a visible field. */
  general: string[];
}

export function initialDraft(schema: Schema, props: Draft): Draft {
  return fillDefaults(schema.defaults, props);
}

export function resetDraft(schema: Schema): Draft {
  return structuredClone(schema.defaults);
}

export function visibleFields(
  fields: readonly FieldDescriptor[],
  draft: Readonly<Draft>,
): FieldDescriptor[] {
  return fields.filter((f) => isFieldVisible(f, draft));
}

export function setField(draft: Readonly<Draft>, key: string, value: unknown): Draft {
  return { ...draft, [key]: value };
}

const ERROR_LINE = /^([A-Za-z0-9_.-]+): ([\s\S]*)$/;

export function validateDraft(schema: Schema, draft: Readonly<Draft>): DraftValidation {
  const result = schema.validate(draft);
  if (result.ok) return { valid: true, props: result.props, byField: {}, general: [] };
  const visible = new Set(visibleFields(schema.fields, draft).map((f) => f.key));
  const known = new Set(schema.fields.map((f) => f.key));
  const byField: Record<string, string[]> = {};
  const general: string[] = [];
  for (const line of result.errors) {
    const match = ERROR_LINE.exec(line);
    const key = match?.[1];
    const msg = match?.[2];
    if (key !== undefined && msg !== undefined && visible.has(key)) {
      (byField[key] ??= []).push(msg);
    } else if (key !== undefined && known.has(key)) {
      general.push(line); // a hidden field is invalid: keep its key so the author can tell
    } else {
      general.push(msg ?? line);
    }
  }
  return { valid: false, byField, general };
}

// ---- number helpers ----

function decimals(n: number): number {
  const s = String(n);
  if (s.includes('e-'))
    return Number(s.split('e-')[1] ?? 0) + (s.split('e-')[0]?.split('.')[1]?.length ?? 0);
  return s.split('.')[1]?.length ?? 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Clamps, snaps to `min + k * step`, and rounds away float noise (0.1 steps give 1.2). */
export function snapNumber(value: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(value)) return min;
  const clamped = clamp(value, min, max);
  const snapped = min + Math.round((clamped - min) / step) * step;
  const places = Math.max(decimals(step), decimals(min));
  const rounded = Number(snapped.toFixed(places));
  return rounded > max
    ? clamp(Number((min + Math.floor((max - min) / step) * step).toFixed(places)), min, max)
    : rounded;
}

export function stepNumber(
  value: number,
  dir: 1 | -1,
  min: number,
  max: number,
  step: number,
): number {
  return snapNumber(value + dir * step, min, max, step);
}

// ---- list helpers (immutable) ----

export function listAdd<T>(list: readonly T[], item: T, maxItems = Infinity): T[] {
  return list.length >= maxItems ? [...list] : [...list, item];
}

export function listUpdate<T>(list: readonly T[], index: number, item: T): T[] {
  return list.map((v, i) => (i === index ? item : v));
}

export function listRemove<T>(list: readonly T[], index: number, minItems = 0): T[] {
  return list.length <= minItems ? [...list] : list.filter((_, i) => i !== index);
}

export function listMove<T>(list: readonly T[], index: number, dir: 1 | -1): T[] {
  const to = index + dir;
  const a = list[index];
  const b = list[to];
  if (a === undefined || b === undefined) return [...list];
  const out = [...list];
  out[index] = b;
  out[to] = a;
  return out;
}

// ---- safe value narrowing for controls ----

export const asString = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : fallback;
export const asNumber = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
export const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
export const asNumberArray = (v: unknown): number[] =>
  Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
