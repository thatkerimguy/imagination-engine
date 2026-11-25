import { describe, expect, it } from 'vitest';
import { gridColumns, layoutClassFor, usesRail } from './layout-class.ts';

describe('layoutClassFor', () => {
  it('classifies the Material 3 breakpoints', () => {
    expect(layoutClassFor(386)).toBe('compact'); // desktop-windowing minimum 386 x 352
    expect(layoutClassFor(412)).toBe('compact');
    expect(layoutClassFor(599.9)).toBe('compact');
    expect(layoutClassFor(600)).toBe('medium');
    expect(layoutClassFor(768)).toBe('medium');
    expect(layoutClassFor(839)).toBe('medium');
    expect(layoutClassFor(840)).toBe('expanded');
    expect(layoutClassFor(1024)).toBe('expanded');
    expect(layoutClassFor(1280)).toBe('expanded');
  });
  it('maps classes to grid columns and the rail', () => {
    expect(gridColumns('compact')).toBe(1);
    expect(gridColumns('medium')).toBe(2);
    expect(gridColumns('expanded')).toBe(3);
    expect(usesRail('compact')).toBe(false);
    expect(usesRail('medium')).toBe(true);
    expect(usesRail('expanded')).toBe(true);
  });
});
