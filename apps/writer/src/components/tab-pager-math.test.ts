import { describe, expect, it } from 'vitest';
import {
  clampIndex,
  dragOffset,
  inEdgeDeadZone,
  isHorizontalIntent,
  rootBackTarget,
  shouldClaimSwipe,
  snapTarget,
} from './tab-pager-math.ts';

const W = 390;

describe('edge dead zone (Android system back wins)', () => {
  it('rejects swipes that start at either edge', () => {
    expect(inEdgeDeadZone(10, W)).toBe(true);
    expect(inEdgeDeadZone(W - 12, W)).toBe(true);
  });
  it('accepts swipes that start inside the content', () => {
    expect(inEdgeDeadZone(60, W)).toBe(false);
    expect(shouldClaimSwipe(60, -40, 4, W)).toBe(true);
    expect(shouldClaimSwipe(10, -40, 4, W)).toBe(false);
    expect(shouldClaimSwipe(W - 12, 40, 4, W)).toBe(false);
  });
  it('never claims before layout', () => {
    expect(shouldClaimSwipe(100, -40, 0, 0)).toBe(false);
  });
});

describe('horizontal vs vertical intent', () => {
  it('needs more than 16 dp of horizontal travel', () => {
    expect(isHorizontalIntent(16, 0)).toBe(false);
    expect(isHorizontalIntent(17, 0)).toBe(true);
  });
  it('yields to vertical scrolling unless dx beats dy by 1.5x', () => {
    expect(isHorizontalIntent(30, 20)).toBe(false);
    expect(isHorizontalIntent(-31, 20)).toBe(true);
    expect(isHorizontalIntent(5, 80)).toBe(false);
  });
});

describe('snap targets', () => {
  it('commits past 25% of the width', () => {
    expect(snapTarget(0, -(W * 0.26), 0, W)).toBe(1);
    expect(snapTarget(1, W * 0.26, 0, W)).toBe(0);
    expect(snapTarget(1, -(W * 0.2), 0, W)).toBe(1);
  });
  it('commits a brisk flick in the drag direction', () => {
    expect(snapTarget(1, -40, -0.8, W)).toBe(2);
    expect(snapTarget(1, 40, 0.8, W)).toBe(0);
    expect(snapTarget(1, 40, -0.8, W)).toBe(1);
  });
  it('clamps at [0, 2]', () => {
    expect(snapTarget(0, W, 2, W)).toBe(0);
    expect(snapTarget(2, -W, -2, W)).toBe(2);
    expect(clampIndex(-1)).toBe(0);
    expect(clampIndex(5)).toBe(2);
  });
});

describe('drag offset', () => {
  it('follows the finger between tabs and resists past the ends', () => {
    expect(dragOffset(1, -50, W)).toBe(-W - 50);
    expect(dragOffset(0, 100, W)).toBeCloseTo(30);
    expect(dragOffset(2, -100, W)).toBeCloseTo(-2 * W - 30);
  });
});

describe('root back unwinding', () => {
  it('Search and Notes return to Library; Library exits', () => {
    expect(rootBackTarget(2)).toBe(0);
    expect(rootBackTarget(1)).toBe(0);
    expect(rootBackTarget(0)).toBeNull();
  });
});
