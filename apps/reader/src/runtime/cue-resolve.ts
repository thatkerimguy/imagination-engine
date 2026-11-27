// Resolves a chapter `module` cue to a v2 blueprint + validated props:
//   1. `props.blueprintId` → inline chapter blueprint (re-guarded) or a starter blueprint
//   2. a retired v1 moduleId (cyberbrain, gaslight, ghost-whisper, system box) → LEGACY_CUES
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
  const { starterBlueprint, LEGACY_CUES } = await import('@kn/engines/blueprints');
  const { blueprintId, ...rest } = req.props;
  let blueprint: GimmickBlueprint | null = null;
  let raw: Record<string, unknown> = rest;

  if (typeof blueprintId === 'string') {
    const own = inline?.[blueprintId];
    if (own !== undefined) {
      const g = guardBlueprint(own);
      if (!g.ok)
        return { ok: false, error: `Blueprint “${blueprintId}” was rejected: ${g.errors[0]}` };
      blueprint = g.blueprint;
    } else {
      blueprint = starterBlueprint(blueprintId);
    }
    if (blueprint && req.moduleVersion > blueprint.version) {
      return {
        ok: false,
        error: `${blueprint.name} v${req.moduleVersion} needs a newer reader (has v${blueprint.version}).`,
      };
    }
    if (!blueprint) return { ok: false, error: `Unknown gimmick “${blueprintId}”.` };
  } else {
    const cue = LEGACY_CUES[req.moduleId];
    if (cue) {
      blueprint = starterBlueprint(cue.blueprintId);
      raw = cue.map(req.props);
    }
    if (!blueprint) return { ok: false, error: `Unknown spectacle “${req.moduleId}”.` };
  }

  const props = resolveBlueprintProps(blueprint, raw);
  if (!props.ok)
    return { ok: false, error: `${blueprint.name}: ${props.errors.slice(0, 3).join('; ')}` };
  return { ok: true, blueprint, props: props.props };
}
