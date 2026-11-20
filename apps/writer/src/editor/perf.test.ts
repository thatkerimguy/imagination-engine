import type { Block } from '@kn/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentMetrics } from '../analysis/metrics.ts';
import { sheetsToMount } from './sheet-mount.ts';
import { createLiveEngine, TYPING_DECAY_MS } from './live-engine.ts';

const closed = { sheet: null, commentOpen: false, pickerOpen: false, gimmickSheetOpen: false };

describe('editor sheets mount lazily', () => {
  it('mounts nothing when every sheet is closed', () => {
    expect(sheetsToMount(closed)).toEqual([]);
  });

  it('mounts only the open sheets', () => {
    expect(sheetsToMount({ ...closed, sheet: 'analysis' })).toEqual(['analysis']);
    expect(sheetsToMount({ ...closed, commentOpen: true })).toEqual(['comment']);
    expect(sheetsToMount({ ...closed, pickerOpen: true, gimmickSheetOpen: true })).toEqual([
      'picker',
      'gimmick',
    ]);
  });
});

describe('live metrics idle quiescence', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function make() {
    let runs = 0;
    let chars = 0;
    const onChange = vi.fn();
    const analyze = (): DocumentMetrics => {
      runs += 1;
      chars += 40;
      return { chars } as unknown as DocumentMetrics;
    };
    return { engine: createLiveEngine(onChange, analyze), runs: () => runs, onChange };
  }

  it('has no timers before any typing', () => {
    const { engine, runs } = make();
    engine.arm();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(runs()).toBe(0);
  });

  it('decays once after typing stops, then runs no timers or analyzers', () => {
    const { engine, runs, onChange } = make();
    const first: Block[] = [];
    const second: Block[] = [];
    engine.compute(first);
    vi.advanceTimersByTime(300);
    expect(engine.compute(second).typingCpm).toBeGreaterThan(0);
    engine.arm();
    expect(vi.getTimerCount()).toBe(1);
    expect(runs()).toBe(2);

    vi.advanceTimersByTime(TYPING_DECAY_MS);
    expect(onChange).toHaveBeenCalledTimes(1);
    const decayed = engine.compute(second);
    expect(decayed.typingCpm).toBe(0);
    engine.arm();

    vi.advanceTimersByTime(10 * 60_000);
    expect(vi.getTimerCount()).toBe(0);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(runs()).toBe(2);
  });
});
