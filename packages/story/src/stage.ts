import { z } from 'zod';
import { STAGE_COLORS } from './colors.ts';
import { labelSchema } from './schema.ts';

export { STAGE_COLORS, type StageColor } from './colors.ts';

/*
 * Params of the stage actions (ADR 0015). Like audio, `.set` actions are scene state the runtime
 * remembers (backgrounds and looks come back after a load or rewind); the rest are moments.
 */

export const STAGE_BACKGROUNDS = ['none', 'rain', 'embers', 'stars', 'snow'] as const;
export type StageBackground = (typeof STAGE_BACKGROUNDS)[number];

export const STAGE_LOOKS = ['none', 'film', 'crt', 'noir', 'dream'] as const;
export type StageLook = (typeof STAGE_LOOKS)[number];

export const STAGE_BURSTS = ['burst', 'sparks'] as const;
export const STAGE_TRANSITIONS = ['dissolve', 'ink', 'wipe'] as const;

const unit = z.number().min(0).max(1);
const materialId = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/);
/** A material id, or '' while the author hasn't picked one. */
const materialRef = z.union([materialId, z.literal('')]);

export const backgroundSetSchema = z.object({
  preset: z.enum(STAGE_BACKGROUNDS),
  /** How dense the effect is, 0..1 (1 = the preset's full amount). */
  amount: unit.optional(),
});
export type BackgroundSet = z.infer<typeof backgroundSetSchema>;

export const lookSetSchema = z.object({ look: z.enum(STAGE_LOOKS) });
export type LookSet = z.infer<typeof lookSetSchema>;

export const shakeSchema = z.object({ strength: unit });
export type Shake = z.infer<typeof shakeSchema>;

export const flashSchema = z.object({ color: z.enum(STAGE_COLORS).optional() });
export type Flash = z.infer<typeof flashSchema>;

export const hitStopSchema = z.object({ seconds: z.number().min(0.02).max(1) });

export const burstSchema = z.object({
  preset: z.enum(STAGE_BURSTS),
  /** Characters to throw instead of the preset's own. */
  glyphs: z.string().max(12).optional(),
  color: z.enum(STAGE_COLORS).optional(),
});
export type Burst = z.infer<typeof burstSchema>;

export const titleSchema = z.object({
  /** Large text drawn on the stage, in both languages. */
  text: labelSchema,
  /** Seconds on screen before it leaves. */
  seconds: z.number().min(0.5).max(20).optional(),
  exit: z.enum(['fade', 'shatter']).optional(),
  color: z.enum(STAGE_COLORS).optional(),
  /** A text material that colours and moves its glyphs (ADR 0020). */
  material: materialRef.optional(),
});
export type Title = z.infer<typeof titleSchema>;

export const transitionSchema = z.object({
  kind: z.enum(STAGE_TRANSITIONS),
  seconds: z.number().min(0.2).max(4).optional(),
});
export type Transition = z.infer<typeof transitionSchema>;

/** The post material drawn over the whole screen; '' turns it off. Scene state (ADR 0020). */
export const postSetSchema = z.object({ material: materialRef });
export type PostSet = z.infer<typeof postSetSchema>;

/** Sets a material parameter, or ramps it from `value` to `to` over `seconds`. */
export const materialParamActionSchema = z.object({
  material: materialRef,
  param: z.union([materialId, z.literal('')]),
  value: z.number(),
  to: z.number().optional(),
  seconds: z.number().min(0).max(30).optional(),
});
export type MaterialParamAction = z.infer<typeof materialParamActionSchema>;

export const STAGE_ACTIONS = {
  'stage.background.set': backgroundSetSchema,
  'stage.look.set': lookSetSchema,
  'stage.shake': shakeSchema,
  'stage.flash': flashSchema,
  'stage.hitstop': hitStopSchema,
  'stage.burst': burstSchema,
  'stage.title': titleSchema,
  'stage.transition': transitionSchema,
  'stage.post.set': postSetSchema,
  'stage.material.param': materialParamActionSchema,
} as const;
export type StageActionId = keyof typeof STAGE_ACTIONS;

export function isStageAction(action: string): action is StageActionId {
  return action in STAGE_ACTIONS;
}
