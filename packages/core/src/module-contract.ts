// The declarative module contract. Pure data + pure functions: this file is imported by the
// web reader's sandbox today and by the Expo writer's bottom sheet in Phase 2, so it must never
// touch the DOM or any renderer dependency.

export const moduleGenres = ['core', 'gits', 'black-lagoon', 'psych-thriller'] as const;
export const moduleLayers = ['backdrop', 'inline', 'overlay-vfx', 'audio-haptic'] as const;
export const assetKinds = ['audio', 'image', 'model'] as const;

export type ModuleGenre = (typeof moduleGenres)[number];
export type ModuleLayer = (typeof moduleLayers)[number];
export type AssetKind = (typeof assetKinds)[number];

export interface ModuleMeta {
  /** Must equal the module's folder name, e.g. `bl-dice-3d`. */
  id: string;
  /** Integer; bump on breaking prop changes. Blocks record the version they were written with. */
  version: number;
  name: string;
  genre: ModuleGenre;
  /** A single emoji, so both the native writer and the web sandbox can show it without assets. */
  icon: string;
  layer: ModuleLayer;
  description: string;
}

/** Shows a field only while another field equals a value (no expressions, by design). */
export interface ShowWhen {
  field: string;
  equals: string | number | boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

interface FieldBase<K extends string> {
  key: K;
  label: string;
  help?: string;
  showWhen?: ShowWhen;
}

export type FieldDescriptor<K extends string = string> =
  | (FieldBase<K> & { type: 'text'; placeholder?: string; maxLength?: number })
  | (FieldBase<K> & { type: 'multiline'; placeholder?: string; maxLength?: number })
  | (FieldBase<K> & { type: 'number'; min: number; max: number; step: number; unit?: string })
  | (FieldBase<K> & { type: 'toggle' })
  | (FieldBase<K> & { type: 'select'; options: readonly SelectOption[] })
  | (FieldBase<K> & {
      type: 'multi-select';
      options: readonly SelectOption[];
      minItems?: number;
      maxItems?: number;
    })
  | (FieldBase<K> & { type: 'color'; swatches?: readonly string[] })
  | (FieldBase<K> & {
      type: 'string-list';
      minItems?: number;
      maxItems?: number;
      itemLabel?: string;
    })
  | (FieldBase<K> & {
      type: 'number-list';
      min: number;
      max: number;
      step: number;
      minItems?: number;
      maxItems?: number;
    })
  | (FieldBase<K> & { type: 'asset'; assetKind: AssetKind });

export type FieldType = FieldDescriptor['type'];

export type ValidationResult<P> = { ok: true; props: P } | { ok: false; errors: string[] };

export interface ModuleSchemaDefinition<P extends object = Record<string, unknown>> {
  meta: ModuleMeta;
  fields: readonly FieldDescriptor<Extract<keyof P, string>>[];
  defaults: P;
  /** Fills defaults, checks every field, then runs the module's own cross-field rules. */
  validate(props: unknown): ValidationResult<P>;
}

export interface ModuleCard {
  title: string;
  subtitle: string;
  badge?: string;
}

export type ModuleCardFormatter<P extends object = Record<string, unknown>> = (
  props: P,
) => ModuleCard;

/** Optional cross-field rules a module adds on top of the generic field checks. */
export type ModuleRefinement<P> = (props: P) => string[];

export function defineModuleSchema<P extends object>(spec: {
  meta: ModuleMeta;
  fields: readonly FieldDescriptor<Extract<keyof P, string>>[];
  defaults: P;
  refine?: ModuleRefinement<P>;
}): ModuleSchemaDefinition<P> {
  const { meta, fields, defaults, refine } = spec;
  return {
    meta,
    fields,
    defaults,
    validate(raw: unknown): ValidationResult<P> {
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, errors: ['props: expected an object'] };
      }
      const merged = fillDefaults(defaults, raw as Record<string, unknown>);
      const errors = fields.flatMap((f) => validateField(f, merged[f.key]));
      if (errors.length > 0) return { ok: false, errors };
      const props = merged as P;
      const extra = refine?.(props) ?? [];
      return extra.length > 0 ? { ok: false, errors: extra } : { ok: true, props };
    },
  };
}

/** Shallow merge: unknown keys are dropped so stale props from old versions never leak through. */
export function fillDefaults<P extends object>(
  defaults: P,
  props: Readonly<Record<string, unknown>>,
): P & Record<string, unknown> {
  const out: Record<string, unknown> = Object.fromEntries(Object.entries(defaults));
  for (const key of Object.keys(defaults)) {
    if (props[key] !== undefined) out[key] = props[key];
  }
  return out as P & Record<string, unknown>;
}

export function isFieldVisible(
  field: FieldDescriptor,
  props: Readonly<Record<string, unknown>>,
): boolean {
  return !field.showWhen || props[field.showWhen.field] === field.showWhen.equals;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function validateField(field: FieldDescriptor, value: unknown): string[] {
  const at = (msg: string): string[] => [`${field.key}: ${msg}`];
  switch (field.type) {
    case 'text':
    case 'multiline':
    case 'asset':
      if (typeof value !== 'string') return at('expected text');
      if (
        field.type !== 'asset' &&
        field.maxLength !== undefined &&
        value.length > field.maxLength
      ) {
        return at(`at most ${field.maxLength} characters`);
      }
      return [];
    case 'number':
      return checkNumber(value, field.min, field.max, field.step).flatMap((m) => at(m));
    case 'toggle':
      return typeof value === 'boolean' ? [] : at('expected on/off');
    case 'select':
      return typeof value === 'string' && field.options.some((o) => o.value === value)
        ? []
        : at('not one of the options');
    case 'color':
      return typeof value === 'string' && HEX_COLOR.test(value) ? [] : at('expected #rrggbb');
    case 'multi-select': {
      if (!isStringArray(value)) return at('expected a list');
      if (value.some((v) => !field.options.some((o) => o.value === v))) return at('unknown option');
      return checkCount(value.length, field.minItems, field.maxItems).flatMap((m) => at(m));
    }
    case 'string-list':
      if (!isStringArray(value)) return at('expected a list of text');
      return checkCount(value.length, field.minItems, field.maxItems).flatMap((m) => at(m));
    case 'number-list': {
      if (!Array.isArray(value)) return at('expected a list of numbers');
      const itemErrors = value.flatMap((v, i) =>
        checkNumber(v, field.min, field.max, field.step).map((m) => `item ${i + 1} ${m}`),
      );
      return [...itemErrors, ...checkCount(value.length, field.minItems, field.maxItems)].flatMap(
        (m) => at(m),
      );
    }
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function checkNumber(value: unknown, min: number, max: number, step: number): string[] {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ['expected a number'];
  if (value < min || value > max) return [`must be between ${min} and ${max}`];
  const steps = (value - min) / step;
  if (Math.abs(steps - Math.round(steps)) > 1e-6) return [`must move in steps of ${step}`];
  return [];
}

function checkCount(n: number, min = 0, max = Infinity): string[] {
  if (n < min) return [`needs at least ${min} item${min === 1 ? '' : 's'}`];
  if (n > max) return [`allows at most ${max} items`];
  return [];
}
