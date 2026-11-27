// Shared shapes for the bespoke-3d spectacles.
export interface Running {
  /** Resolves when the spectacle has fully cleared (or was stopped). */
  done: Promise<void>;
  /** Instant teardown: frame loop, sound, GPU resources and the stage lease. Idempotent. */
  stop(): void;
  values?: number[];
}

export type Spectacle = 'dice-throw' | 'zippo-lighter';
export const SPECTACLES: readonly Spectacle[] = ['dice-throw', 'zippo-lighter'];
