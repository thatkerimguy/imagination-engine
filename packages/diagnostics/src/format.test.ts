import { describe, expect, it } from 'vitest';
import { average, formatBytes, formatMs, percentile, refreshRateFromIntervals } from './format.ts';

describe('format helpers', () => {
  it('computes percentiles and averages', () => {
    const values = [5, 1, 4, 2, 3];
    expect(percentile(values, 50)).toBe(3);
    expect(percentile(values, 95)).toBe(5);
    expect(percentile(values, 0)).toBe(1);
    expect(percentile([], 50)).toBeUndefined();
    expect(average([2, 4])).toBe(3);
  });

  it('formats bytes and milliseconds', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(6 * 1024 ** 3)).toBe('6.0 GB');
    expect(formatBytes(1536, 'tr-TR')).toBe('1,5 KB');
    expect(formatBytes(undefined)).toBe('—');
    expect(formatMs(4.26)).toBe('4.3 ms');
    expect(formatMs(16.7)).toBe('17 ms');
  });

  it('turns frame intervals into a refresh rate', () => {
    expect(refreshRateFromIntervals([8.3, 8.4, 8.3, 16.6, 8.3])).toBe(120);
    expect(refreshRateFromIntervals([16.7, 16.6, 16.7])).toBe(60);
    expect(refreshRateFromIntervals([])).toBeUndefined();
    expect(refreshRateFromIntervals([1000, 1001, 999])).toBeUndefined();
  });
});
