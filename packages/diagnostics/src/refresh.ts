import { refreshRateFromIntervals } from './format.ts';

/**
 * Estimates the display refresh rate by timing animation frames. The Redmi Note 12 reports 60 or
 * 120 Hz depending on its refresh setting and battery saver.
 */
export function measureRefreshRate(durationMs = 1000): Promise<number | undefined> {
  if (typeof requestAnimationFrame !== 'function' || document.visibilityState === 'hidden') {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    const intervals: number[] = [];
    let last: number | undefined;
    let start: number | undefined;
    const tick = (now: number) => {
      start ??= now;
      if (last !== undefined) intervals.push(now - last);
      last = now;
      if (now - start < durationMs) requestAnimationFrame(tick);
      else resolve(refreshRateFromIntervals(intervals));
    };
    requestAnimationFrame(tick);
  });
}
