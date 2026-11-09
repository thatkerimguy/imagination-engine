import { describe, expect, it, vi } from 'vitest';
import { StateStore } from './state.ts';

describe('StateStore', () => {
  it('stores copies of values', () => {
    const state = new StateStore();
    const list = [1, 2];
    state.set('game.items', list);
    list.push(3);
    expect(state.get('game.items')).toEqual([1, 2]);
    const read = state.get('game.items') as number[];
    read.push(9);
    expect(state.get('game.items')).toEqual([1, 2]);
  });

  it('notifies key and wildcard listeners only on real changes', () => {
    const state = new StateStore();
    const key = vi.fn();
    const all = vi.fn();
    state.subscribe('game.gold', key);
    state.subscribe('*', all);
    state.set('game.gold', 10);
    state.set('game.gold', 10);
    state.set('game.mood', 'calm');
    expect(key).toHaveBeenCalledTimes(1);
    expect(key).toHaveBeenCalledWith('game.gold', 10, undefined);
    expect(all).toHaveBeenCalledTimes(2);
  });

  it('rejects bad keys and non-JSON values', () => {
    const state = new StateStore();
    expect(() => state.set('has space', 1)).toThrow(/dot-separated/);
    expect(() => state.set('game.n', Number.NaN)).toThrow(/JSON-safe/);
  });

  it('snapshots and restores, notifying changed keys', () => {
    const state = new StateStore();
    state.set('a', 1);
    state.set('b', 'x');
    const snap = state.snapshot();
    state.set('a', 2);
    state.set('c', true);
    const listener = vi.fn();
    state.subscribe('*', listener);
    state.restore(snap);
    expect(state.snapshot()).toEqual({ a: 1, b: 'x' });
    const changedKeys = listener.mock.calls.map((call) => call[0] as string).sort();
    expect(changedKeys).toEqual(['a', 'c']);
  });

  it('lists keys by prefix and deletes', () => {
    const state = new StateStore();
    state.set('chapter.one', 1);
    state.set('chapter.two', 2);
    state.set('game.gold', 3);
    expect(state.keys('chapter.').sort()).toEqual(['chapter.one', 'chapter.two']);
    state.delete('chapter.one');
    expect(state.has('chapter.one')).toBe(false);
  });
});
