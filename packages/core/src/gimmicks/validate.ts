// Full Zod validation for Gimmick Blueprints: the writer, the gimmick factory and tests only.
// NEVER imported by apps/reader (it uses the zero-dependency `guardBlueprint` instead).
import * as z from 'zod/mini';
import { ORNAMENT_GRAMMARS, SURFACE_MATERIALS } from '../dna/types.ts';
import { checkProps } from './props.ts';
import { securityIssues } from './security.ts';
import {
  ACCENT_ROLES,
  BORDER_STYLES,
  ENGINE_IDS,
  HAPTIC_PATTERNS,
  MOTION_PRESETS,
  STINGER_PATCHES,
  type BlueprintFieldSpec,
  type GimmickBlueprint,
} from './types.ts';

const slug = z.string().check(z.regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'Expected a lowercase slug'));
const label = z.string().check(z.minLength(1), z.maxLength(80));
const shortText = z.string().check(z.maxLength(160));
const template = z.string().check(z.maxLength(4000));
const key = z.string().check(z.regex(/^[a-zA-Z][a-zA-Z0-9]{0,31}$/, 'Expected a camelCase key'));
const option = z.object({ value: slug, label });

const base = { key, label, help: z.optional(shortText), optional: z.optional(z.boolean()) };
const count = { minItems: z.optional(z.number()), maxItems: z.optional(z.number()) };
const textLike = { maxLength: z.optional(z.number()), placeholder: z.optional(shortText) };

const fieldSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('text'), ...textLike }),
  z.object({ ...base, type: z.literal('multiline'), ...textLike }),
  z.object({ ...base, type: z.literal('list'), ...count, itemLabel: z.optional(label) }),
  z.object({
    ...base,
    type: z.literal('records'),
    ...count,
    itemLabel: z.optional(label),
    columns: z
      .array(
        z.object({
          key,
          label,
          type: z.enum(['text', 'number', 'select']),
          options: z.optional(z.array(option)),
          optional: z.optional(z.boolean()),
        }),
      )
      .check(z.minLength(1), z.maxLength(8)),
  }),
  z.object({ ...base, type: z.literal('select'), options: z.array(option).check(z.minLength(1)) }),
  z.object({
    ...base,
    type: z.literal('number'),
    min: z.number(),
    max: z.number(),
    step: z.number().check(z.positive()),
    unit: z.optional(z.string().check(z.maxLength(8))),
  }),
  z.object({ ...base, type: z.literal('boolean') }),
  z.object({ ...base, type: z.literal('color') }),
]);

const record = z.record(z.string(), z.union([z.string(), z.number()]));
const propValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.array(record),
]);
const propsRecord = z.record(z.string(), propValue);

export const gimmickBlueprintSchema = z.object({
  id: slug,
  version: z.number().check(z.int(), z.positive()),
  engine: z.enum(ENGINE_IDS),
  genre: slug,
  subgenre: slug,
  mood: z.array(slug).check(z.maxLength(8)),
  tags: z.array(slug).check(z.maxLength(16)),
  name: label,
  tagline: shortText,
  tier: z.enum(['free', 'pro']),
  fields: z.array(fieldSchema).check(z.maxLength(16)),
  defaultProps: propsRecord,
  sampleProps: propsRecord,
  visual: z.object({
    layout: slug,
    ornament: z.enum([...ORNAMENT_GRAMMARS, 'inherit']),
    surface: z.optional(z.enum([...SURFACE_MATERIALS, 'inherit'])),
    accentRole: z.enum(ACCENT_ROLES),
    borderStyle: z.enum(BORDER_STYLES),
    motionPreset: z.enum(MOTION_PRESETS),
  }),
  sound: z.optional(
    z.object({
      patch: z.enum(STINGER_PATCHES),
      gain: z.optional(z.number().check(z.gte(0), z.lte(1))),
      pitchShift: z.optional(z.number().check(z.gte(-12), z.lte(12))),
    }),
  ),
  haptics: z.optional(z.enum(HAPTIC_PATTERNS)),
  exports: z.object({
    transcript: template,
    summary: template,
    epubXhtml: template,
    royalRoadHtml: template,
  }),
});

// Compile-time proof that the Zod schema and the zero-dep `GimmickBlueprint` type agree.
type Parsed = z.infer<typeof gimmickBlueprintSchema>;
export const blueprintTypesAgree: [Parsed] extends [GimmickBlueprint]
  ? [GimmickBlueprint] extends [Parsed]
    ? true
    : false
  : false = true;

export type BlueprintResult =
  { ok: true; blueprint: GimmickBlueprint } | { ok: false; errors: string[] };

/** Structure, then security (scripts, handlers, external URLs, tag allowlist), then props. */
export function validateBlueprint(raw: unknown): BlueprintResult {
  const parsed = gimmickBlueprintSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  const bp: GimmickBlueprint = parsed.data;
  const errors = [
    ...securityIssues(bp),
    ...duplicateKeys(bp.fields),
    ...checkProps(bp.fields, bp.defaultProps, true).map((e) => `defaultProps.${e}`),
    ...checkProps(bp.fields, bp.sampleProps, false).map((e) => `sampleProps.${e}`),
  ];
  return errors.length ? { ok: false, errors } : { ok: true, blueprint: bp };
}

function duplicateKeys(fields: readonly BlueprintFieldSpec[]): string[] {
  const seen = new Set<string>();
  return fields.flatMap((f) => {
    if (seen.has(f.key)) return [`fields: duplicate key "${f.key}"`];
    seen.add(f.key);
    return [];
  });
}
