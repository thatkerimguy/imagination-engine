import type { Block } from '@kn/core';
import { describe, expect, it } from 'vitest';
import {
  createReadAloud,
  nextSpeed,
  speakableSegments,
  speedLabel,
  type ReadSegment,
  type SpeakOptions,
  type SpeechAdapter,
} from './read-aloud.ts';

const prose = (id: string, text: string): Block => ({ id, kind: 'prose', text }) as Block;

class Fake implements SpeechAdapter {
  spoken: string[] = [];
  rates: number[] = [];
  stops = 0;
  last: SpeakOptions | null = null;
  speak(text: string, opts: SpeakOptions): void {
    this.spoken.push(text);
    this.rates.push(opts.rate);
    this.last = opts;
  }
  stop(): void {
    this.stops++;
  }
  available = (): boolean => true;
}

const segs = (n: number): ReadSegment[] =>
  Array.from({ length: n }, (_, i) => ({ blockIndex: i, blockId: `b${i}`, text: `t${i}` }));

describe('speakableSegments', () => {
  it('strips markup, formats dialogue, skips breaks and empties', () => {
    const blocks = [
      prose('a', 'It was **bold** and {fg:#ff0000}red{/fg}.'),
      { id: 'b', kind: 'scene-break' },
      { id: 'c', kind: 'dialogue', speaker: 'Mara', text: '*Run.*' },
      prose('d', '   '),
    ] as Block[];
    expect(speakableSegments(blocks)).toEqual([
      { blockIndex: 0, blockId: 'a', text: 'It was bold and red.' },
      { blockIndex: 2, blockId: 'c', text: 'Mara: Run.' },
    ]);
  });
});

describe('speed', () => {
  it('cycles and labels', () => {
    expect(nextSpeed(0.85)).toBe(1);
    expect(nextSpeed(1.5)).toBe(0.85);
    expect(nextSpeed(7)).toBe(1);
    expect(speedLabel(0.85)).toBe('0.85×');
    expect(speedLabel(1)).toBe('1×');
  });
});

describe('createReadAloud', () => {
  it('advances on done and stops at the end', () => {
    const a = new Fake();
    const r = createReadAloud(a, segs(2));
    r.play();
    expect(a.spoken).toEqual(['t0']);
    a.last!.onDone();
    expect(r.getState()).toMatchObject({ status: 'playing', index: 1 });
    a.last!.onDone();
    expect(r.getState()).toMatchObject({ status: 'idle', index: 0 });
    expect(a.spoken).toEqual(['t0', 't1']);
  });

  it('respects prev/next bounds', () => {
    const a = new Fake();
    const r = createReadAloud(a, segs(2));
    r.prev();
    expect(r.getState().index).toBe(0);
    r.next();
    r.next();
    expect(r.getState().index).toBe(1);
    expect(a.spoken).toEqual([]);
    r.prev();
    r.play();
    r.next();
    expect(a.spoken).toEqual(['t0', 't1']);
  });

  it('ignores a stale done after skipping', () => {
    const a = new Fake();
    const r = createReadAloud(a, segs(3));
    r.play();
    const stale = a.last!;
    r.next();
    stale.onDone();
    expect(r.getState().index).toBe(1);
  });

  it('pauses by stopping and resumes the same segment', () => {
    const a = new Fake();
    const r = createReadAloud(a, segs(3));
    r.play(1);
    r.pause();
    expect(r.getState()).toMatchObject({ status: 'paused', index: 1 });
    r.resume();
    expect(a.spoken).toEqual(['t1', 't1']);
    expect(r.getState().status).toBe('playing');
  });

  it('stop resets to idle at the start', () => {
    const a = new Fake();
    const r = createReadAloud(a, segs(3));
    r.play(2);
    r.stop();
    expect(r.getState()).toMatchObject({ status: 'idle', index: 0 });
    expect(a.stops).toBeGreaterThan(0);
  });

  it('applies a new speed to the current segment and notifies', () => {
    const a = new Fake();
    const r = createReadAloud(a, segs(2));
    const seen: string[] = [];
    r.onChange((s) => seen.push(s.status));
    r.play();
    r.setSpeed(1.5);
    expect(a.rates).toEqual([1, 1.5]);
    expect(seen[0]).toBe('playing');
  });

  it('error returns to idle; setSegments keeps the active block', () => {
    const a = new Fake();
    const r = createReadAloud(a, segs(3));
    r.play(2);
    r.setSegments(segs(3).slice(1));
    expect(r.getState().index).toBe(1);
    a.last!.onError();
    expect(r.getState().status).toBe('idle');
  });
});
