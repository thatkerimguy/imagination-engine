// Live tier switching. The reader settings sheet and the writer preview dispatch `kn:tier-change`
// on window; every mounted v2 engine context listens and downgrades / upgrades in place, so
// Calm Mode and tier switches apply instantly without reloading the chapter.
import type { QualityTier } from '@kn/core/renderer';

export const TIER_EVENT = 'kn:tier-change';

export interface TierChange {
  tier: QualityTier;
  calm: boolean;
}

let current: TierChange | null = null;

/** The latest live tier (null until the first chapter mounts). */
export const liveTier = (): TierChange | null => current;

export function dispatchTierChange(tier: QualityTier, calm: boolean): void {
  const next = { tier: calm ? 'reduced' : tier, calm } satisfies TierChange;
  const changed = !current || current.tier !== next.tier || current.calm !== next.calm;
  current = next;
  document.documentElement.dataset.tier = next.tier;
  if (changed) window.dispatchEvent(new CustomEvent<TierChange>(TIER_EVENT, { detail: next }));
}

/** Records the tier a chapter mounted with, without notifying (nothing is listening yet). */
export function seedTier(tier: QualityTier, calm: boolean): void {
  current = { tier: calm ? 'reduced' : tier, calm };
}
