// Live editor metrics: the 27 analyzers over the chapter, recalculated at most every 250 ms, with
// typing speed from a rolling meter. While typing speed is above zero a single timeout decays it
// back to 0 after the Author pauses; when idle there are no timers and no analyzer runs.
import type { Block } from '@kn/core';
import { useEffect, useRef, useState } from 'react';
import type { DocumentMetrics } from '../analysis/metrics.ts';
import { createLiveEngine, type LiveEngine } from './live-engine.ts';
import { useThrottledValue } from './MetricsRibbon.tsx';

export function useLiveMetrics(source: readonly Block[]): DocumentMetrics {
  const blocks = useThrottledValue(source, 250);
  const [, redraw] = useState(0);
  const engine = useRef<LiveEngine | null>(null);
  engine.current ??= createLiveEngine(() => redraw((n) => n + 1));
  const metrics = engine.current.compute(blocks);
  useEffect(() => {
    engine.current?.arm();
  }, [metrics]);
  useEffect(() => () => engine.current?.dispose(), []);
  return metrics;
}
