import { describe, expect, it } from 'vitest';
import { jsonEqual, merge3 } from './merge.ts';

describe('merge3', () => {
  it('takes whichever side changed', () => {
    expect(merge3(1, 1, 2).value).toBe(2);
    expect(merge3(1, 3, 1).value).toBe(3);
    expect(merge3({ a: 1 }, { a: 1 }, { a: 1, b: 2 }).value).toEqual({ a: 1, b: 2 });
  });

  it('merges different keys changed on each side', () => {
    const base = { title: 'A', author: 'K', n: 1 };
    const { value, conflicts } = merge3(base, { ...base, title: 'B' }, { ...base, n: 2 });
    expect(value).toEqual({ title: 'B', author: 'K', n: 2 });
    expect(conflicts).toEqual([]);
  });

  it('settles a real conflict by the preferred side and reports the path', () => {
    const base = { title: { en: 'A' } };
    const ours = { title: { en: 'B' } };
    const theirs = { title: { en: 'C' } };
    expect(merge3(base, ours, theirs)).toEqual({ value: ours, conflicts: ['/title/en'] });
    expect(merge3(base, ours, theirs, 'theirs').value).toEqual(theirs);
  });

  it('removes a key one side removed', () => {
    expect(merge3({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 2 }).value).toEqual({ a: 1 });
  });

  it('merges lists by id: adds, edits and removals from both sides', () => {
    const base = [
      { id: 'p1', text: 'one' },
      { id: 'p2', text: 'two' },
      { id: 'p3', text: 'three' },
    ];
    const ours = [
      { id: 'p1', text: 'ONE' },
      { id: 'p2', text: 'two' },
      { id: 'p4', text: 'four' },
    ]; // edited p1, removed p3, added p4
    const theirs = [
      { id: 'p1', text: 'one' },
      { id: 'p5', text: 'five' },
      { id: 'p3', text: 'three' },
    ]; // removed p2, added p5 after p1
    expect(merge3(base, ours, theirs).value).toEqual([
      { id: 'p1', text: 'ONE' },
      { id: 'p5', text: 'five' },
      { id: 'p4', text: 'four' },
    ]);
  });

  it('keeps an item one side removed when the other side edited it', () => {
    const base = [{ id: 'a', n: 1 }];
    expect(merge3(base, [], [{ id: 'a', n: 2 }]).value).toEqual([{ id: 'a', n: 2 }]);
  });

  it('merges without a base by keeping both sides', () => {
    const { value } = merge3<unknown>(undefined, { list: [{ id: 'a' }] }, { list: [{ id: 'b' }] });
    expect(value).toEqual({ list: [{ id: 'a' }, { id: 'b' }] });
  });

  it('keeps unchanged objects identical so undo snapshots stay shared', () => {
    const shared = { id: 'x', deep: { v: 1 } };
    const ours = { a: shared, b: 1 };
    const result = merge3({ a: shared, b: 0 }, ours, { a: shared, b: 0 });
    expect(result.value).toBe(ours);
    const both = merge3(
      { a: shared, b: 0, c: 0 },
      { a: shared, b: 1, c: 0 },
      { a: shared, b: 0, c: 1 },
    );
    expect(both.value.a).toBe(shared);
  });

  it('compares JSON deeply and ignores undefined keys', () => {
    expect(jsonEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(jsonEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(jsonEqual([1], [1, 2])).toBe(false);
  });
});
