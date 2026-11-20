// Live editor metrics: the 27 analyzers over the chapter, recalculated at most every 250 ms, with
// typing speed from a rolling meter refreshed every 5 s so it decays while the Author pauses.
import type { Block } from '@kn/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentMetrics } from '../analysis/metrics.ts';
import { analyzeDocument, createTypingMeter } from '../analysis/realtime.ts';
import { useThrottledValue } from './MetricsRibbon.tsx';

export function useLiveMetrics(source: readonly Block[]): DocumentMetrics {
  const blocks = useThrottledValue(source, 250);
  const meter = useRef(createTypingMeter());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => {
    void tick;
    const now = Date.now();
    const base = analyzeDocument(blocks);
    meter.current.record(base.chars, now);
    const typing = meter.current.speed(now);
    return { ...base, typingCpm: typing.cpm, typingWpm: typing.wpm };
  }, [blocks, tick]);
}
