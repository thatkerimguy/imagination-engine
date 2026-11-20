import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, createHistory, pushHistory, redo, undo } from './history.ts';

const typing = (blockId: string, now: number) => ({ kind: 'typing', blockId, now }) as const;
const boundary = { kind: 'boundary' } as const;

describe('history', () => {
  it('coalesces typing in the same block within 800ms', () => {
    let h = createHistory(0);
    h = pushHistory(h, 1, typing('a', 1000));
    h = pushHistory(h, 2, typing('a', 1500));
    h = pushHistory(h, 3, typing('a', 2200));
    expect(h.present).toBe(3);
    expect(h.past).toEqual([0]);
  });

  it('does not coalesce across blocks or long pauses', () => {
    let h = createHistory(0);
    h = pushHistory(h, 1, typing('a', 1000));
    h = pushHistory(h, 2, typing('b', 1100));
    h = pushHistory(h, 3, typing('b', 3000));
    expect(h.past).toEqual([0, 1, 2]);
  });

  it('boundaries always push and break coalescing', () => {
    let h = createHistory(0);
    h = pushHistory(h, 1, typing('a', 1000));
    h = pushHistory(h, 2, boundary);
    h = pushHistory(h, 3, typing('a', 1100));
    expect(h.past).toEqual([0, 1, 2]);
  });

  it('ignores identical next', () => {
    const h = createHistory(5);
    expect(pushHistory(h, 5, boundary)).toBe(h);
  });

  it('caps past at 100', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 150; i++) h = pushHistory(h, i, boundary);
    expect(h.past).toHaveLength(100);
    expect(h.past[0]).toBe(50);
  });

  it('undo/redo and pushing clears future', () => {
    let h = createHistory(0);
    h = pushHistory(h, 1, boundary);
    h = pushHistory(h, 2, boundary);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present).toBe(2);
    expect(canRedo(h)).toBe(false);
    h = undo(undo(h));
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    h = pushHistory(h, 9, boundary);
    expect(h.future).toEqual([]);
    expect(undo(createHistory(0)).present).toBe(0);
  });
});
