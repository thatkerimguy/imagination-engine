/**
 * Quality tiers and the frame-time governor (PLAN §11.1). A tier sets how much the stage may
 * draw; the governor steps down when frames run long, because the reference phone throttles
 * under sustained load, and steps back up only after a long calm.
 */
export type TierName = 'low' | 'medium' | 'high';

export interface QualityTier {
  readonly name: TierName;
  /** Canvas pixels per CSS pixel, before the device pixel ratio cap. */
  readonly maxPixelRatio: number;
  readonly maxParticles: number;
  /** Post effects at this fraction of the stage's resolution; 0 turns them off. */
  readonly postScale: number;
  /** Grain, chromatic aberration and scanlines: the costly per-pixel extras. */
  readonly richPost: boolean;
}

export const TIERS: Readonly<Record<TierName, QualityTier>> = {
  low: { name: 'low', maxPixelRatio: 1, maxParticles: 800, postScale: 0, richPost: false },
  medium: {
    name: 'medium',
    maxPixelRatio: 1.5,
    maxParticles: 3000,
    postScale: 0.5,
    richPost: false,
  },
  high: { name: 'high', maxPixelRatio: 2, maxParticles: 6000, postScale: 1, richPost: true },
};

const ORDER: readonly TierName[] = ['low', 'medium', 'high'];

export interface GpuInfo {
  /** The unmasked renderer string, e.g. "ANGLE (Qualcomm, Adreno (TM) 610, OpenGL ES 3.2)". */
  readonly renderer?: string;
  readonly mobile: boolean;
  readonly cores?: number;
}

/**
 * A starting tier from what the device says about itself. Entry-level mobile GPUs start at
 * medium (the reference phone's budget: 1.5× resolution, half-resolution post); unknown mobiles
 * too; desktops at high. The governor corrects a wrong guess within seconds.
 */
export function detectTier(info: GpuInfo): TierName {
  const renderer = (info.renderer ?? '').toLowerCase();
  if (/swiftshader|llvmpipe|software|basic render/.test(renderer)) return 'low';
  if (info.mobile) {
    const adreno = /adreno[^\d]*(\d{3})/.exec(renderer);
    if (adreno && Number(adreno[1]) < 600) return 'low';
    if (/mali-(t|g3|g5)|powervr|videocore/.test(renderer)) return 'low';
    return 'medium';
  }
  if ((info.cores ?? 8) <= 2) return 'medium';
  return 'high';
}

export interface GovernorOptions {
  /** Frame time that counts as too long, in ms (a 60 fps frame is 16.7). */
  readonly slowMs?: number;
  /** How long frames must run slow before stepping down, in ms. */
  readonly downAfterMs?: number;
  /** How long frames must run well before stepping up, in ms. */
  readonly upAfterMs?: number;
  /** The highest tier the governor may return to (the detected one). */
  readonly ceiling?: TierName;
}

/** Steps the tier down after 5 s of slow frames and up after 30 s of fast ones. */
export class FrameGovernor {
  private slowFor = 0;
  private fastFor = 0;
  private smoothed = 16.7;
  private readonly slowMs: number;
  private readonly downAfterMs: number;
  private readonly upAfterMs: number;
  private readonly ceiling: TierName;

  constructor(
    public tier: TierName,
    options: GovernorOptions = {},
  ) {
    this.slowMs = options.slowMs ?? 18.5;
    this.downAfterMs = options.downAfterMs ?? 5000;
    this.upAfterMs = options.upAfterMs ?? 30000;
    this.ceiling = options.ceiling ?? tier;
  }

  /** Feeds one frame's duration; returns the tier when it changed, else null. */
  frame(ms: number): TierName | null {
    // A long gap (a hidden tab, a pause) says nothing about rendering cost.
    if (ms > 250) return null;
    this.smoothed += (ms - this.smoothed) * 0.1;
    if (this.smoothed > this.slowMs) {
      this.slowFor += ms;
      this.fastFor = 0;
    } else {
      this.fastFor += ms;
      this.slowFor = 0;
    }
    const index = ORDER.indexOf(this.tier);
    if (this.slowFor >= this.downAfterMs && index > 0) return this.change(ORDER[index - 1]);
    if (
      this.fastFor >= this.upAfterMs &&
      this.smoothed < this.slowMs * 0.6 &&
      index < ORDER.indexOf(this.ceiling)
    )
      return this.change(ORDER[index + 1]);
    return null;
  }

  private change(tier: TierName | undefined): TierName | null {
    if (!tier) return null;
    this.tier = tier;
    this.slowFor = 0;
    this.fastFor = 0;
    this.smoothed = 16.7;
    return tier;
  }
}
