// Pure blueprint-form model: values <-> props, per-field errors and row editing helpers.
// The form never invents data: unedited values round-trip to exactly the blueprint's props.
import {
  checkField,
  resolveBlueprintProps,
  type BlueprintFieldSpec,
  type BlueprintProps,
  type BlueprintPropValue,
  type BlueprintRecord,
  type GimmickBlueprint,
  type RecordColumn,
} from '@kn/core/gimmicks';

export type FormValues = BlueprintProps;
export type FieldErrors = Readonly<Record<string, string[]>>;

type Bp = Pick<GimmickBlueprint, 'fields' | 'defaultProps'>;

const isRecordObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** Defaults merged under `raw` (unknown keys dropped); invalid raw values are kept so the form can flag them. */
export function initialValues(bp: Bp, raw?: unknown): FormValues {
  const input = isRecordObject(raw) ? raw : {};
  const out: FormValues = {};
  for (const f of bp.fields) {
    const v = input[f.key] !== undefined ? input[f.key] : bp.defaultProps[f.key];
    if (v !== undefined) out[f.key] = v as BlueprintPropValue;
  }
  return out;
}

export function fieldErrors(bp: Bp, values: FormValues): FieldErrors {
  const out: Record<string, string[]> = {};
  for (const f of bp.fields) {
    const errs = checkField(f, values[f.key]);
    if (errs.length) out[f.key] = errs;
  }
  return out;
}

export const errorCount = (errors: FieldErrors): number => Object.keys(errors).length;

/** `{ blueprintId, ...props }` when every field is valid, else null. */
export function toCueProps(
  bp: Pick<GimmickBlueprint, 'id' | 'fields' | 'defaultProps'>,
  values: FormValues,
): Record<string, BlueprintPropValue> | null {
  const r = resolveBlueprintProps(bp, values);
  return r.ok ? { blueprintId: bp.id, ...r.props } : null;
}

/** Sets one value; an emptied optional field is removed instead of stored as ''. */
function omit<T extends object>(o: T, key: string): T {
  return Object.fromEntries(Object.entries(o).filter(([k]) => k !== key)) as T;
}

export function setValue(
  values: FormValues,
  f: BlueprintFieldSpec,
  v: BlueprintPropValue,
): FormValues {
  const empty = v === '' || (typeof v === 'number' && !Number.isFinite(v));
  if (f.optional && empty) return omit(values, f.key);
  return { ...values, [f.key]: v };
}

// Typed readers for control values (the stored value is untrusted until validated).
export const textOf = (v: unknown): string => (typeof v === 'string' ? v : '');
export const numberOf = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
export const listOf = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
export const recordsOf = (v: unknown): BlueprintRecord[] =>
  Array.isArray(v) ? v.filter(isRecordObject).map((r) => r as BlueprintRecord) : [];

/** A new empty row: '' for text, the first option for select, 0 for number columns. */
export function blankRecord(columns: readonly RecordColumn[]): BlueprintRecord {
  const row: BlueprintRecord = {};
  for (const c of columns) {
    if (c.type === 'number') row[c.key] = 0;
    else if (c.type === 'select') row[c.key] = c.options?.[0]?.value ?? '';
    else if (!c.optional) row[c.key] = '';
  }
  return row;
}

export function setCell(
  rows: readonly BlueprintRecord[],
  index: number,
  col: RecordColumn,
  v: string | number,
): BlueprintRecord[] {
  return rows.map((r, i) => {
    if (i !== index) return r;
    return col.optional && v === '' ? omit(r, col.key) : { ...r, [col.key]: v };
  });
}

export function moveAt<T>(list: readonly T[], i: number, dir: 1 | -1): T[] {
  const j = i + dir;
  const a = list[i];
  const b = list[j];
  if (a === undefined || b === undefined) return [...list];
  const out = [...list];
  out[i] = b;
  out[j] = a;
  return out;
}

export const removeAt = <T>(list: readonly T[], i: number): T[] => list.filter((_, k) => k !== i);
export const replaceAt = <T>(list: readonly T[], i: number, item: T): T[] =>
  list.map((x, k) => (k === i ? item : x));
