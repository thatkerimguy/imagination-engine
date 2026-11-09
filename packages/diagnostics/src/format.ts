/** Value at percentile `p` (0–100) using nearest-rank; `undefined` for an empty list. */
export function percentile(values: readonly number[], p: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))];
}

export function average(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** `1.5 KB` in English, `1,5 KB` in Turkish (pass a BCP 47 tag). */
export function formatBytes(bytes: number | undefined, localeTag = 'en-US'): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '—';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 100 || unit === 0 ? 0 : 1;
  const number = new Intl.NumberFormat(localeTag, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return `${number} ${UNITS[unit]}`;
}

export function formatMs(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms)) return '—';
  return `${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`;
}

/**
 * Median frame interval → refresh rate in Hz. Returns `undefined` for implausible results, which
 * happen when the tab is hidden or throttled and frames arrive about once a second.
 */
export function refreshRateFromIntervals(intervals: readonly number[]): number | undefined {
  const median = percentile(intervals, 50);
  if (median === undefined || median <= 0) return undefined;
  const hz = Math.round(1000 / median);
  return hz >= 24 && hz <= 500 ? hz : undefined;
}
