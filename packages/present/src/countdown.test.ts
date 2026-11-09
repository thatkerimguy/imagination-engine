import { describe, expect, it } from 'vitest';
import { Countdown } from './countdown.ts';
import type { Scheduler } from './typewriter.ts';

function fakeTime() {
  let now = 0;
  let pending: { at: number; fn: () => void } | null = null;
  const scheduler: Scheduler = {
    set: (fn, ms) => (pending = { at: now + ms, fn }),
    clear: () => (pending = null),
  };
  const advance = (ms: number) => {
    now += ms;
    if (pending && pending.at <= now) {
      const { fn } = pending;
      pending = null;
      fn();
    }
  };
  return { scheduler, advance, now: () => now };
}

describe('Countdown', () => {
  it('fires once after its time, and holding stops the clock', () => {
    const time = fakeTime();
    let fired = 0;
    const countdown = new Countdown(1000, () => fired++, time.now, time.scheduler);
    countdown.start();
    time.advance(400);
    countdown.pause();
    expect(countdown.elapsed).toBe(400);
    expect(countdown.paused).toBe(true);
    time.advance(5000);
    expect(fired).toBe(0);
    countdown.resume();
    time.advance(599);
    expect(fired).toBe(0);
    time.advance(1);
    expect(fired).toBe(1);
    expect(countdown.paused).toBe(false);
  });

  it('never fires after being cancelled', () => {
    const time = fakeTime();
    let fired = false;
    const countdown = new Countdown(100, () => (fired = true), time.now, time.scheduler);
    countdown.start();
    countdown.cancel();
    countdown.start();
    time.advance(1000);
    expect(fired).toBe(false);
  });
});
