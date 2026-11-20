import { describe, expect, it } from 'vitest';
import { segmentEnds, segmentOf } from './segments.ts';

describe('segments', () => {
  it('ends segments on beat stops', () => {
    const ends = segmentEnds([{}, { beatStop: true }, {}, {}, { beatStop: true }, {}]);
    expect(ends).toEqual([1, 4, 5]);
    expect(segmentOf(ends, 0)).toBe(0);
    expect(segmentOf(ends, 2)).toBe(1);
    expect(segmentOf(ends, 5)).toBe(2);
  });

  it('does not add an empty segment for a final beat stop', () => {
    expect(segmentEnds([{}, { beatStop: true }])).toEqual([1]);
  });
});
