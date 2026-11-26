import { describe, expect, it } from 'vitest';
import { COMPACT_LANDSCAPE_MAX_HEIGHT, shouldAutoCollapseMetrics } from './landscape-chrome.ts';

const base = { windowWidth: 900, windowHeight: 400, keyboardVisible: true, userCollapsed: false };

describe('shouldAutoCollapseMetrics', () => {
  it('exports the 500 dp threshold', () => expect(COMPACT_LANDSCAPE_MAX_HEIGHT).toBe(500));
  it('portrait + keyboard keeps the user value', () => {
    const r = { ...base, windowWidth: 400, windowHeight: 800 };
    expect(shouldAutoCollapseMetrics(r)).toBe(false);
  });
  it('tall landscape tablet keeps the user value', () => {
    const r = { ...base, windowWidth: 1280, windowHeight: 800 };
    expect(shouldAutoCollapseMetrics(r)).toBe(false);
  });
  it('compact landscape + keyboard collapses', () => {
    expect(shouldAutoCollapseMetrics(base)).toBe(true);
  });
  it('keyboard hidden restores the user value', () => {
    expect(shouldAutoCollapseMetrics({ ...base, keyboardVisible: false })).toBe(false);
  });
  it('a user collapse always stays collapsed', () => {
    for (const keyboardVisible of [true, false])
      for (const [windowWidth, windowHeight] of [
        [900, 400],
        [400, 800],
        [1280, 800],
      ] as const)
        expect(
          shouldAutoCollapseMetrics({
            windowWidth,
            windowHeight,
            keyboardVisible,
            userCollapsed: true,
          }),
        ).toBe(true);
  });
});
