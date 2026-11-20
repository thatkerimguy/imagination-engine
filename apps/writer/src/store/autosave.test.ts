import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosaver, type SaveStatus } from './autosave.ts';

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

describe('createAutosaver', () => {
  it('collapses rapid schedules into one save with the latest value', async () => {
    const save = vi.fn(async () => {});
    const statuses: SaveStatus[] = [];
    const saver = createAutosaver(save, (s) => statuses.push(s), 600);
    saver.schedule('a');
    saver.schedule('b');
    saver.schedule('c');
    await vi.advanceTimersByTimeAsync(599);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('c');
    expect(statuses.at(-1)).toBe('saved');
  });

  it('reports pending -> saving -> saved', async () => {
    const statuses: SaveStatus[] = [];
    const saver = createAutosaver(
      async () => {},
      (s) => statuses.push(s),
    );
    saver.schedule(1);
    await vi.runAllTimersAsync();
    expect(statuses).toEqual(['pending', 'saving', 'saved']);
  });

  it('flush saves immediately', async () => {
    const save = vi.fn(async () => {});
    const saver = createAutosaver(save, () => {});
    saver.schedule(7);
    await saver.flush();
    expect(save).toHaveBeenCalledWith(7);
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('never overlaps a save in flight', async () => {
    const resolvers: (() => void)[] = [];
    let active = 0;
    let maxActive = 0;
    const order: string[] = [];
    const save = vi.fn(
      (v: string) =>
        new Promise<void>((resolve) => {
          active++;
          maxActive = Math.max(maxActive, active);
          order.push(v);
          resolvers.push(() => {
            active--;
            resolve();
          });
        }),
    );
    const saver = createAutosaver(save, () => {}, 100);
    saver.schedule('first');
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
    saver.schedule('second');
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
    resolvers[0]?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    resolvers[1]?.();
    await vi.runAllTimersAsync();
    expect(order).toEqual(['first', 'second']);
    expect(maxActive).toBe(1);
  });

  it('reports error status on rejection', async () => {
    const boom = new Error('boom');
    const onStatus = vi.fn();
    const saver = createAutosaver(() => Promise.reject(boom), onStatus);
    saver.schedule(1);
    await vi.runAllTimersAsync();
    expect(onStatus).toHaveBeenLastCalledWith('error', boom);
  });

  it('dispose cancels a pending save', async () => {
    const save = vi.fn(async () => {});
    const saver = createAutosaver(save, () => {});
    saver.schedule(1);
    saver.dispose();
    await vi.runAllTimersAsync();
    expect(save).not.toHaveBeenCalled();
  });
});
