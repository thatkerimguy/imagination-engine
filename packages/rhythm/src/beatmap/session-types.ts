import type { CheckpointKind } from './prepare.ts';
import type { Judgement, Rank } from './rules.ts';

/* What a beatmap play reports: events for the view to show, running stats, and the result. */

export type PlayEvent =
  | {
      readonly kind: 'judged';
      readonly index: number;
      readonly judgement: Judgement;
      readonly x: number;
      readonly y: number;
      /** Milliseconds early (negative) or late; null when no tap judged it. */
      readonly offset: number | null;
    }
  | {
      readonly kind: 'part';
      readonly index: number;
      readonly part: 'head' | CheckpointKind;
      readonly ok: boolean;
      readonly x: number;
      readonly y: number;
      readonly offset?: number;
    }
  | { readonly kind: 'comboBreak'; readonly combo: number }
  | { readonly kind: 'failed' }
  | { readonly kind: 'finished' };

export interface PlayStats {
  score: number;
  combo: number;
  maxCombo: number;
  readonly counts: Record<Judgement, number>;
  health: number;
}

export interface PlayResult {
  readonly won: boolean;
  readonly failed: boolean;
  readonly accuracy: number;
  readonly rank: Rank;
  readonly score: number;
  readonly maxCombo: number;
  readonly counts: Readonly<Record<Judgement, number>>;
  /** Mean tap offset in ms (positive: late). */
  readonly meanOffset: number;
  /** Standard deviation of tap offsets in ms. */
  readonly spread: number;
  /** Played by Watch picked on the start card: it shows the chart but settles nothing. */
  readonly watched: boolean;
  /** Strength ran out under a picked Can't fail: played to the end, but not a pass. */
  readonly emptied: boolean;
}
