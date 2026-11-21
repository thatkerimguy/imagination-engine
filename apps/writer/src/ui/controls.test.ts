import { describe, expect, it } from 'vitest';
import { isNoteEmpty, shouldDeleteOnExit } from '../notes/note-empty.ts';
import { mergeSeg, slideAction, syncOptimistic, thumbTarget } from './control-math.ts';

describe('segment thumb math', () => {
  it('offsets the thumb by one hairline from the measured x', () => {
    expect(thumbTarget({ x: 100, w: 80 }, 0.5)).toBe(99.5);
  });

  it('places on first measure, slides on change, ignores an identical target', () => {
    expect(slideAction(null, 3)).toBe('place');
    expect(slideAction(3, 90)).toBe('slide');
    expect(slideAction(90, 90)).toBe('none');
  });

  it('keeps the segment map stable when onLayout repeats the same box', () => {
    const m = { a: { x: 0, w: 50 } };
    expect(mergeSeg(m, 'a', 0, 50)).toBe(m);
    expect(mergeSeg(m, 'a', 0, 60)).toEqual({ a: { x: 0, w: 60 } });
    expect(mergeSeg(m, 'b', 50, 50)).toEqual({ a: { x: 0, w: 50 }, b: { x: 50, w: 50 } });
  });
});

describe('optimistic value sync', () => {
  it('keeps the tapped value until the parent value changes', () => {
    expect(syncOptimistic('b', 'a', 'a')).toBe('b');
  });
  it('follows an external change', () => {
    expect(syncOptimistic('b', 'a', 'c')).toBe('c');
  });
});

describe('abandoned empty notes', () => {
  const prose = (text: string) => ({ kind: 'prose', text });
  it('is empty with no title and only blank text', () => {
    expect(isNoteEmpty('', [])).toBe(true);
    expect(isNoteEmpty('  ', [prose(''), prose(' \n ')])).toBe(true);
  });
  it('is kept with any title, text or scene break', () => {
    expect(isNoteEmpty('Ideas', [])).toBe(false);
    expect(isNoteEmpty('', [prose(''), prose('hi')])).toBe(false);
    expect(isNoteEmpty('', [{ kind: 'scene-break' }])).toBe(false);
  });
  it('deletes on exit only if it was empty at open and still is', () => {
    expect(shouldDeleteOnExit(true, '', [prose('')])).toBe(true);
    expect(shouldDeleteOnExit(false, '', [prose('')])).toBe(false);
    expect(shouldDeleteOnExit(true, '', [prose('x')])).toBe(false);
    expect(shouldDeleteOnExit(true, 'T', [])).toBe(false);
  });
});
