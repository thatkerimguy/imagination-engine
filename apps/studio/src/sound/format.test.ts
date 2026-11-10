import type { TrackAnalysis } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { beatInBar, formatTime, keyParts } from './format.ts';

const analysis: TrackAnalysis = {
  v: 1,
  tracker: 'dsp-1',
  duration: 10,
  bpm: 120,
  tempo: 'constant',
  beats: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5],
  downbeats: [1, 5],
  beatsPerBar: 4,
  sections: [0],
};

describe('sound format', () => {
  it('formats times', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(-3)).toBe('0:00');
  });

  it('names keys', () => {
    expect(keyParts({ tonic: 9, mode: 'minor' })).toEqual({ tonic: 'A', mode: 'minor' });
    expect(keyParts(undefined)).toBeNull();
  });

  it('places beats in the bar', () => {
    expect(beatInBar(analysis, 1)).toBe(0);
    expect(beatInBar(analysis, 2)).toBe(1);
    expect(beatInBar(analysis, 5)).toBe(0);
    expect(beatInBar(analysis, 8)).toBe(3);
    // A pickup before the first downbeat counts back from it.
    expect(beatInBar(analysis, 0)).toBe(3);
  });
});
