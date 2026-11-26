// Live Preview quality-tier segments (Auto / High / Lite / Reduced).
import type { SegmentOption } from '../ui/SegmentControl.tsx';
import { PREVIEW_TIERS, type PreviewTier } from './protocol.ts';

const TIER_LABEL: Record<PreviewTier, string> = {
  auto: 'Auto',
  high: 'High',
  lite: 'Lite',
  reduced: 'Reduced',
};

export const TIER_SEGMENTS: readonly SegmentOption<PreviewTier>[] = PREVIEW_TIERS.map((t) => ({
  value: t,
  label: TIER_LABEL[t],
  testID: `preview-tier-${t}`,
}));
