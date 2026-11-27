// Author props for a blueprint: check them against the field specs and merge over the defaults.
// Zero dependencies; shared by the validator, the reader engines and (later) the writer forms.
import type {
  BlueprintFieldSpec,
  BlueprintPropValue,
  BlueprintProps,
  BlueprintRecord,
  RecordColumn,
} from './types.ts';

const HEX = /^#[0-9a-fA-F]{6}$/;

function countIssue(n: number, min?: number, max?: number): string | null {
  if (min !== undefined && n < min) return `needs at least ${min}`;
  if (max !== undefined && n > max) return `allows at most ${max}`;
  return null;
}

function checkRecord(cols: readonly RecordColumn[], r: unknown, i: number): string[] {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return [`item ${i + 1} expected an object`];
  const rec = r as Record<string, unknown>;
  return cols.flatMap((c) => {
    const v = rec[c.key];
    if (v === undefined) return c.optional ? [] : [`item ${i + 1} ${c.key} missing`];
    if (c.type === 'number') return typeof v === 'number' ? [] : [`item ${i + 1} ${c.key} number`];
    if (typeof v !== 'string') return [`item ${i + 1} ${c.key} expected text`];
    if (c.type === 'select' && !c.options?.some((o) => o.value === v))
      return [`item ${i + 1} ${c.key} not an option`];
    return [];
  });
}

export function checkField(f: BlueprintFieldSpec, v: BlueprintPropValue | undefined): string[] {
  const at = (msg: string): string[] => [`${f.key}: ${msg}`];
  if (v === undefined) return f.optional ? [] : at('missing');
  switch (f.type) {
    case 'text':
    case 'multiline':
      if (typeof v !== 'string') return at('expected text');
      return f.maxLength !== undefined && v.length > f.maxLength
        ? at(`at most ${f.maxLength} characters`)
        : [];
    case 'list': {
      if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) return at('expected a list');
      const c = countIssue(v.length, f.minItems, f.maxItems);
      return c ? at(c) : [];
    }
    case 'records': {
      if (!Array.isArray(v)) return at('expected a list of items');
      const c = countIssue(v.length, f.minItems, f.maxItems);
      return [...(c ? [c] : []), ...v.flatMap((r, i) => checkRecord(f.columns, r, i))].flatMap(at);
    }
    case 'select':
      return typeof v === 'string' && f.options.some((o) => o.value === v)
        ? []
        : at('not one of the options');
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) return at('expected a number');
      return v < f.min || v > f.max ? at(`must be between ${f.min} and ${f.max}`) : [];
    case 'boolean':
      return typeof v === 'boolean' ? [] : at('expected on/off');
    case 'color':
      return typeof v === 'string' && HEX.test(v) ? [] : at('expected #rrggbb');
  }
}

/** `complete`: every required field needs a value (defaults); otherwise only present keys. */
export function checkProps(
  fields: readonly BlueprintFieldSpec[],
  props: Readonly<BlueprintProps>,
  complete: boolean,
): string[] {
  const known = new Set(fields.map((f) => f.key));
  const unknown = Object.keys(props)
    .filter((k) => !known.has(k))
    .map((k) => `${k}: not a field of this blueprint`);
  const checked = fields.flatMap((f) =>
    !complete && props[f.key] === undefined ? [] : checkField(f, props[f.key]),
  );
  return [...unknown, ...checked];
}

export type PropsResult = { ok: true; props: BlueprintProps } | { ok: false; errors: string[] };

/** Merges raw props over the blueprint defaults (unknown keys dropped) and checks every field. */
export function resolveBlueprintProps(
  bp: { fields: readonly BlueprintFieldSpec[]; defaultProps: BlueprintProps },
  raw: unknown,
): PropsResult {
  const input = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<
    string,
    unknown
  >;
  const merged: BlueprintProps = {};
  for (const f of bp.fields) {
    const v = input[f.key] !== undefined ? input[f.key] : bp.defaultProps[f.key];
    if (v !== undefined) merged[f.key] = v as BlueprintPropValue;
  }
  const errors = bp.fields.flatMap((f) => checkField(f, merged[f.key]));
  return errors.length ? { ok: false, errors } : { ok: true, props: merged };
}

/** Typed readers for engines (props are already validated; these only narrow). */
export const propText = (p: BlueprintProps, k: string, fallback = ''): string => {
  const v = p[k];
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback;
};
export const propList = (p: BlueprintProps, k: string): string[] => {
  const v = p[k];
  if (typeof v === 'string') return v ? [v] : [];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
};
export const propRecords = (p: BlueprintProps, k: string): BlueprintRecord[] => {
  const v = p[k];
  return Array.isArray(v)
    ? v.filter((x): x is BlueprintRecord => !!x && typeof x === 'object')
    : [];
};
export const propNumber = (p: BlueprintProps, k: string, fallback = 0): number => {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
};
export const propBool = (p: BlueprintProps, k: string, fallback = false): boolean => {
  const v = p[k];
  return typeof v === 'boolean' ? v : fallback;
};
