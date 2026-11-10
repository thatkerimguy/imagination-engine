import type { TrackAnalysis } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { Conductor, measureLatency, tapGrid, type ClockSource } from './conductor.ts';
import { TempoMap } from './tempo.ts';

const analysis = (beats: number[], tempo: 'constant' | 'variable', bpm = 120): TrackAnalysis => ({
  v: 1,
  tracker: 'test',
  duration: 30,
  bpm,
  tempo,
  beats,
  downbeats: [1, 5],
  beatsPerBar: 4,
  sections: [0],
});

describe('TempoMap', () => {
  it('maps time and beats both ways at a constant tempo', () => {
    const map = TempoMap.constant(120, 1, 4);
    expect(map.beatAt(1)).toBe(0);
    expect(map.beatAt(3)).toBe(4);
    expect(map.beatAt(0.5)).toBe(-1);
    expect(map.timeAt(8)).toBe(5);
    expect(map.position(3.25)).toEqual({ bar: 1, beat: 0.5 });
    expect(map.nextOnGrid(1.1, 1)).toBe(1.5);
    expect(map.nextOnGrid(1.1, 0.25)).toBeCloseTo(1.125);
  });

  it('starts counting at the first downbeat of an analysis', () => {
    const map = TempoMap.fromAnalysis(analysis([0.5, 1, 1.5, 2, 2.5, 3], 'constant'));
    expect(map.beatAt(1)).toBeCloseTo(0);
    expect(map.timeAt(2)).toBeCloseTo(2);
  });

  it('follows every beat when the tempo varies', () => {
    const map = TempoMap.fromAnalysis(analysis([0, 1, 1.5, 1.75, 2, 2.25], 'variable'));
    expect(map.beatAt(1.5)).toBeCloseTo(1);
    expect(map.beatAt(1.625)).toBeCloseTo(1.5);
    expect(map.timeAt(-1)).toBeCloseTo(0);
    // Past the end it keeps the last tempo (0.25 s per beat).
    expect(map.timeAt(6)).toBeCloseTo(2.75);
  });
});

describe('Conductor', () => {
  it('passes exact sources through, minus latency', () => {
    let pos = 2;
    const source: ClockSource = { position: () => pos, playing: true, exact: true };
    const c = new Conductor(TempoMap.constant(60), source, { latency: 0.1 });
    expect(c.time()).toBeCloseTo(1.9);
    pos = 4;
    expect(c.beat()).toBeCloseTo(3.9);
  });

  it('smooths a coarse remote clock and snaps on seeks', () => {
    let wall = 0;
    let reported = 10;
    const source: ClockSource = { position: () => reported, playing: true, exact: false };
    const c = new Conductor(TempoMap.constant(60), source, { now: () => wall });
    expect(c.time()).toBe(10);
    wall = 100; // no new report yet: extrapolate
    expect(c.time()).toBeCloseTo(10.1);
    wall = 200;
    reported = 10.25; // 50 ms behind the prediction (10.2 → 10.25 is 50 ms ahead)
    expect(c.time()).toBeCloseTo(10.2 + 0.05 * 0.1);
    wall = 300;
    reported = 30; // a seek
    expect(c.time()).toBe(30);
  });
});

describe('tap calibration', () => {
  it('fits a grid to slightly uneven taps', () => {
    const taps = [5.0, 5.51, 5.99, 6.5, 7.02, 7.49, 8.0, 8.5];
    const grid = tapGrid(taps);
    expect(grid?.bpm).toBeCloseTo(120, 0);
    expect(grid?.offset).toBeCloseTo(5, 1);
  });

  it('ignores a skipped beat', () => {
    const grid = tapGrid([1, 1.5, 2, 3, 3.5, 4, 4.5]);
    expect(grid?.bpm).toBeCloseTo(120, 0);
  });

  it('measures latency as the median lateness', () => {
    const clicks = [0, 0.5, 1, 1.5, 2, 2.5];
    expect(measureLatency(clicks, [0.04, 0.55, 1.03, 1.56, 2.05, 2.9])).toBeCloseTo(0.05, 2);
  });
});
