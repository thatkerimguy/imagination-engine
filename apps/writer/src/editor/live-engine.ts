// Pure live-metrics engine (no React): analyzes on demand and decays typing speed with ONE timeout.
import type { Block } from '@kn/core';
import type { DocumentMetrics } from '../analysis/metrics.ts';
import { analyzeDocument, createTypingMeter } from '../analysis/realtime.ts';

/** Pause after which the typing meter has fully decayed (its idle window plus a margin). */
export const TYPING_DECAY_MS = 5_500;

export interface DecayTimer {
  /** (Re)arms one timeout while `cpm > 0`; clears it and stays idle when `cpm` is 0. */
  sync(cpm: number): void;
  dispose(): void;
}

/** One decay timeout at most; fires `onDecay` once, then nothing is pending. */
export function createDecayTimer(onDecay: () => void, delay = TYPING_DECAY_MS): DecayTimer {
  let id: ReturnType<typeof setTimeout> | null = null;
  const clear = (): void => {
    if (id !== null) clearTimeout(id);
    id = null;
  };
  return {
    sync(cpm) {
      clear();
      if (cpm <= 0) return;
      id = setTimeout(() => {
        id = null;
        onDecay();
      }, delay);
    },
    dispose: clear,
  };
}

export interface LiveEngine {
  /** Metrics for `blocks`; analyzes only when the blocks identity changes. */
  compute(blocks: readonly Block[]): DocumentMetrics;
  /** Arms the decay timeout while typing speed is above zero (call from an effect). */
  arm(): void;
  dispose(): void;
}

export function createLiveEngine(
  onChange: () => void,
  analyze: (blocks: readonly Block[]) => DocumentMetrics = analyzeDocument,
  now: () => number = Date.now,
): LiveEngine {
  const meter = createTypingMeter();
  let lastBlocks: readonly Block[] | null = null;
  let current: DocumentMetrics | null = null;
  const timer = createDecayTimer(() => {
    if (current) current = { ...current, typingCpm: 0, typingWpm: 0 };
    onChange();
  });
  return {
    compute(blocks) {
      if (current && blocks === lastBlocks) return current;
      const base = analyze(blocks);
      const t = now();
      meter.record(base.chars, t);
      const typing = meter.speed(t);
      lastBlocks = blocks;
      current = { ...base, typingCpm: typing.cpm, typingWpm: typing.wpm };
      return current;
    },
    arm: () => timer.sync(current?.typingCpm ?? 0),
    dispose: timer.dispose,
  };
}
