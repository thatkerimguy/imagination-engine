import { describe, expect, it } from 'vitest';
import { computeKeyboardOffset, computeRevealScroll } from './keyboard-offset.ts';

describe('computeKeyboardOffset', () => {
  it('iOS lifts by the full keyboard height', () => {
    expect(computeKeyboardOffset('ios', 336, 844, 844)).toBe(336);
  });

  it('Android edge-to-edge (window not resized) lifts by the full keyboard height', () => {
    expect(computeKeyboardOffset('android', 300, 800, 800)).toBe(300);
  });

  it('Android adjustResize (window shrunk by the keyboard) adds no second gap', () => {
    expect(computeKeyboardOffset('android', 300, 800, 500)).toBe(0);
  });

  it('Android partial resize lifts only by the remainder', () => {
    expect(computeKeyboardOffset('android', 300, 800, 752)).toBe(252);
  });

  it('never returns a negative offset', () => {
    expect(computeKeyboardOffset('android', 200, 800, 400)).toBe(0);
    expect(computeKeyboardOffset('android', 200, 400, 800)).toBe(200);
    expect(computeKeyboardOffset('ios', -5, 0, 0)).toBe(0);
  });

  it('web never offsets', () => {
    expect(computeKeyboardOffset('web', 300, 800, 800)).toBe(0);
  });
});

describe('computeRevealScroll', () => {
  it('scrolls a covered field above the keyboard with a margin', () => {
    expect(computeRevealScroll(800, 600, 100)).toBe(324);
    expect(computeRevealScroll(800, 600, 0, 0)).toBe(200);
  });
  it('leaves a clear field alone', () => {
    expect(computeRevealScroll(500, 600, 100)).toBeNull();
    expect(computeRevealScroll(576, 600, 100)).toBeNull();
  });
});
