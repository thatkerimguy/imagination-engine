// Resolves a chapter `module` cue to a v2 blueprint + validated props. Every cue carries
// `props.blueprintId`; the blueprint comes from the chapter's inline `blueprints` map (re-guarded,
// the published path) and only falls back to the lazily loaded starter set (sandbox, dev books).
import {
  guardBlueprint,
  resolveBlueprintProps,
  type BlueprintProps,
  type GimmickBlueprint,
} from '@kn/core/gimmicks';
import type { HostRequest } from './block-host.ts';

export type ResolvedCue =
  { ok: true; blueprint: GimmickBlueprint; props: BlueprintProps } | { ok: false; error: string };

export async function resolveCue(
  req: HostRequest,
  inline: Record<string, unknown> | undefined,
): Promise<ResolvedCue> {
  const { blueprintId, ...rest } = req.props;
  if (typeof blueprintId !== 'string')
    return { ok: false, error: `Unknown spectacle “${req.moduleId}”.` };
  let blueprint: GimmickBlueprint | null;
  const own = inline?.[blueprintId];
  if (own !== undefined) {
    const g = guardBlueprint(own);
    if (!g.ok) return { ok: false, error: `Blueprint “${blueprintId}” was rejected: ${g.errors[0]}` };
    blueprint = g.blueprint;
  } else {
    blueprint = (await import('@kn/engines/blueprints')).starterBlueprint(blueprintId);
  }
  if (!blueprint) return { ok: false, error: `Unknown gimmick “${blueprintId}”.` };
  if (req.moduleVersion > blueprint.version) {
    return {
      ok: false,
      error: `${blueprint.name} v${req.moduleVersion} needs a newer reader (has v${blueprint.version}).`,
    };
  }
  const props = resolveBlueprintProps(blueprint, rest);
  if (!props.ok)
    return { ok: false, error: `${blueprint.name}: ${props.errors.slice(0, 3).join('; ')}` };
  return { ok: true, blueprint, props: props.props };
}
