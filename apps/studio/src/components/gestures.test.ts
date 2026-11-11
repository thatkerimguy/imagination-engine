import { describe, expect, it } from 'vitest';
import {
  distance,
  midpoint,
  pinchScale,
  scrollForZoom,
  stepFrom,
  wheelFactor,
} from './gestures.ts';

describe('canvas gestures', () => {
  it('keeps the point under the anchor still when zooming', () => {
    // Content x = (100 + 50) / 1 = 150; at scale 2 it sits at 300, so scroll to 250.
    expect(scrollForZoom(100, 50, 1, 2)).toBe(250);
    expect(scrollForZoom(250, 50, 2, 1)).toBe(100);
    // Never scrolls before the start.
    expect(scrollForZoom(0, 10, 2, 1)).toBe(0);
  });

  it('pinches by the spread of the fingers, within the limits', () => {
    expect(pinchScale(1, 100, 200, 0.5, 1.5)).toBe(1.5);
    expect(pinchScale(1, 100, 80, 0.5, 1.5)).toBeCloseTo(0.8);
    expect(pinchScale(32, 100, 50, 12, 128)).toBe(16);
    expect(pinchScale(1, 0, 50, 0.5, 2)).toBe(1);
  });

  it('turns wheel deltas into zoom factors, line mode included', () => {
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(wheelFactor(100)).toBeLessThan(1);
    expect(wheelFactor(0)).toBe(1);
    expect(wheelFactor(-3, 1)).toBeCloseTo(wheelFactor(-48));
    // A huge flick is capped.
    expect(wheelFactor(-10_000)).toBeCloseTo(wheelFactor(-240));
  });

  it('steps to the next fixed zoom from a free scale', () => {
    const steps = [0.5, 0.75, 1, 1.25];
    expect(stepFrom(steps, 0.9, 1)).toBe(1);
    expect(stepFrom(steps, 0.9, -1)).toBe(0.75);
    expect(stepFrom(steps, 1, 1)).toBe(1.25);
    expect(stepFrom(steps, 1.25, 1)).toBe(1.25);
    expect(stepFrom(steps, 0.5, -1)).toBe(0.5);
  });

  it('measures two fingers', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(midpoint({ x: 0, y: 0 }, { x: 4, y: 2 })).toEqual({ x: 2, y: 1 });
  });
});
