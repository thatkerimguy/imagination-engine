// Pure helpers for v2 cue blocks. Convention shared with the reader: a chapter `module` block with
// `moduleId = blueprint.engine`, `moduleVersion = blueprint.version` and
// `props = { blueprintId, ...fieldProps }`. v1 module blocks have no `blueprintId`.
import type { GimmickBlueprint, BlueprintProps } from '@kn/core/gimmicks';
import { renderBlueprintExport, resolveBlueprintProps } from '@kn/core/gimmicks';
import { starterBlueprint } from '@kn/engines/blueprints';
import { createModuleBlock } from '../store/chapter-ops.ts';

export type CueBlock = ReturnType<typeof createModuleBlock>;

/** True for a v2 cue: its props carry a string `blueprintId`. */
export const isV2Cue = (props: Readonly<Record<string, unknown>>): boolean =>
  typeof props.blueprintId === 'string';

export const cueBlueprintId = (props: Readonly<Record<string, unknown>>): string | null =>
  typeof props.blueprintId === 'string' ? props.blueprintId : null;

/** A new cue block seeded with the blueprint's default field values. */
export function buildCueBlock(bp: GimmickBlueprint): CueBlock {
  return createModuleBlock(bp.engine, bp.version, { blueprintId: bp.id, ...bp.defaultProps });
}

/** The cue's field values (everything except `blueprintId`). */
export function cueFieldProps(props: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...props };
  delete rest.blueprintId;
  return rest;
}

/** Synchronous lookup in the bundled starter pack; the catalog hook covers other packs. */
export const starterCueBlueprint = (
  props: Readonly<Record<string, unknown>>,
): GimmickBlueprint | null => {
  const id = cueBlueprintId(props);
  return id ? starterBlueprint(id) : null;
};

/** One-line plain-text summary of a cue ("LEVEL UP · Level 7"), safe for invalid props. */
export function cueSummary(bp: GimmickBlueprint, props: Readonly<Record<string, unknown>>): string {
  const resolved = resolveBlueprintProps(bp, cueFieldProps(props));
  const values: BlueprintProps = resolved.ok ? resolved.props : bp.defaultProps;
  const text = renderBlueprintExport(bp, values, 'summary').replace(/\s+/g, ' ').trim();
  return text || bp.tagline;
}
