import { describe, expect, it } from 'vitest';
import { createHistory, record, redo, undo } from './history.ts';

describe('undo history', () => {
  it('undoes and redoes steps', () => {
    let h = createHistory('a');
    h = record(h, 'b', null, 0);
    h = record(h, 'c', null, 10);
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    expect(undo(h)).toBe(h);
    h = redo(h);
    expect(h.present).toBe('b');
    h = record(h, 'd', null, 20);
    expect(h.future).toEqual([]);
    expect(redo(h)).toBe(h);
  });

  it('merges quick edits to the same field into one step', () => {
    let h = createHistory('');
    h = record(h, 'H', 'line1', 0);
    h = record(h, 'He', 'line1', 300);
    h = record(h, 'Hel', 'line1', 600);
    expect(h.past).toEqual(['']);
    h = record(h, 'Hel!', 'line1', 5000); // a pause starts a new step
    h = record(h, 'x', 'line2', 5100); // so does another field
    expect(h.past).toEqual(['', 'Hel', 'Hel!']);
    expect(undo(undo(h)).present).toBe('Hel');
  });

  it('ignores an edit that changed nothing', () => {
    const h = createHistory('a');
    expect(record(h, 'a', null, 0)).toBe(h);
  });
});
