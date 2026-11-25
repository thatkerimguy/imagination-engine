import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hitSlopFor, MIN_TOUCH } from './a11y.ts';

const src = (rel: string): string => readFileSync(join(__dirname, '..', rel), 'utf8');

describe('hitSlopFor', () => {
  it('is 48dp', () => expect(MIN_TOUCH).toBe(48));
  it('grows small boxes symmetrically to 48', () => {
    expect(hitSlopFor(44, 26)).toEqual({ top: 11, bottom: 11, left: 2, right: 2 });
    expect(hitSlopFor(32)).toEqual({ top: 8, bottom: 8, left: 8, right: 8 });
  });
  it('never returns negative slop for large boxes', () => {
    expect(hitSlopFor(60, 80)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });
});

describe('static a11y regressions', () => {
  it('IconBtn: labelled button with disabled state and 48dp slop', () => {
    const s = src('ui/IconBtn.tsx');
    expect(s).toContain('accessibilityRole="button"');
    expect(s).toContain('accessibilityLabel={p.accessibilityLabel}');
    expect(s).toContain('disabled: !!p.disabled');
    expect(s).toContain('hitSlopFor(box)');
  });
  it('Toggle: switch role with checked + disabled state, 48dp slop', () => {
    const s = src('ui/Toggle.tsx');
    expect(s).toContain('accessibilityRole="switch"');
    expect(s).toContain('checked: on');
    expect(s).toContain('disabled: !!p.disabled');
    expect(s).toContain('hitSlopFor(W, H)');
  });
  it('SegmentControl: radio options with selected state and 48dp targets', () => {
    const s = src('ui/SegmentControl.tsx');
    expect(s).toContain('accessibilityRole="radio"');
    expect(s).toContain('selected: on');
    expect(s).toContain('minWidth: MIN_TOUCH');
    expect(s).toContain('hitSlopFor(MIN_TOUCH');
  });
  it('Stepper: labelled buttons expose disabled state and 48dp width', () => {
    const s = src('ui/Stepper.tsx');
    expect(s).toContain('accessibilityRole="button"');
    expect(s).toContain('Decrease');
    expect(s).toMatch(/accessibilityState=\{\{ disabled:/);
    expect(s).toContain('width: MIN_TOUCH');
  });
  it('FormattingToolbar: 48dp labelled buttons with selected/disabled state', () => {
    const s = src('editor/FormattingToolbar.tsx');
    expect(s).toContain('minWidth: MIN_TOUCH');
    expect(s).toContain('height: MIN_TOUCH');
    expect(s).toContain('accessibilityLabel={LABELS[id]}');
    expect(s).toContain('selected: on, disabled');
  });
  it('GimmickPill and ChapterRow: >=48dp, reorder reachable by menu items', () => {
    expect(src('editor/GimmickPill.tsx')).toContain('minHeight: MIN_TOUCH');
    const c = src('library/ChapterRow.tsx');
    expect(c).toContain("label: 'Move up'");
    expect(c).toContain("label: 'Move down'");
    expect(c).toContain('minWidth: MIN_TOUCH');
  });
  it('Sheet and ConfirmDialog close on Escape/back and never block Tab focus', () => {
    for (const f of ['ui/Sheet.tsx', 'ui/ConfirmDialog.tsx']) {
      const s = src(f);
      expect(s).toContain('onRequestClose=');
      expect(s).not.toContain('tabIndex={-1}');
    }
  });
});
