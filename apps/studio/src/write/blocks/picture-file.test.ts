import { describe, expect, it } from 'vitest';
import { fitWithin, SHRINK_STEPS } from './picture-file.ts';

describe('fitWithin', () => {
  it('scales the long side down to the limit and keeps the shape', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual([1600, 1200]);
    expect(fitWithin(1080, 1920, 1600)).toEqual([900, 1600]);
  });

  it('never enlarges a small picture', () => {
    expect(fitWithin(640, 480, 1600)).toEqual([640, 480]);
  });

  it('tries smaller and smaller encodings', () => {
    for (let i = 1; i < SHRINK_STEPS.length; i++) {
      const [size, quality] = SHRINK_STEPS[i]!;
      const [prevSize, prevQuality] = SHRINK_STEPS[i - 1]!;
      expect(size <= prevSize && quality <= prevQuality).toBe(true);
    }
  });
});
