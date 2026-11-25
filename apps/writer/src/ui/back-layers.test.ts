import { describe, expect, it, vi, type Mock } from 'vitest';
import {
  handleBackPress,
  lockGateConsumesBack,
  topOpenLayer,
  type BackLayer,
} from './back-layers.ts';

const layer = (open: boolean): { open: boolean; close: Mock<() => void> } => ({
  open,
  close: vi.fn<() => void>(),
});

describe('topOpenLayer', () => {
  it('picks the first open layer (topmost first)', () => {
    const color = layer(false);
    const find = layer(true);
    const focus = layer(true);
    expect(topOpenLayer([color, find, focus], false)).toBe(find);
  });

  it('falls through to the navigator when nothing is open', () => {
    expect(topOpenLayer([layer(false), layer(false)], false)).toBeNull();
    expect(topOpenLayer([], false)).toBeNull();
  });

  it('never targets layers hidden behind the Master Lock', () => {
    expect(topOpenLayer([layer(true)], true)).toBeNull();
  });
});

describe('handleBackPress', () => {
  it('closes only the topmost open layer and consumes back', () => {
    const find = layer(true);
    const focus = layer(true);
    expect(handleBackPress([find, focus], false)).toBe(true);
    expect(find.close).toHaveBeenCalledTimes(1);
    expect(focus.close).not.toHaveBeenCalled();
  });

  it('walks Find → Focus → route pop over successive presses', () => {
    const state = { find: true, focus: true };
    const layers = (): BackLayer[] => [
      { open: state.find, close: () => (state.find = false) },
      { open: state.focus, close: () => (state.focus = false) },
    ];
    expect(handleBackPress(layers(), false)).toBe(true);
    expect(state).toEqual({ find: false, focus: true });
    expect(handleBackPress(layers(), false)).toBe(true);
    expect(state).toEqual({ find: false, focus: false });
    expect(handleBackPress(layers(), false)).toBe(false);
  });

  it('does not consume back (or close anything) while locked', () => {
    const find = layer(true);
    expect(handleBackPress([find], true)).toBe(false);
    expect(find.close).not.toHaveBeenCalled();
  });
});

describe('lockGateConsumesBack', () => {
  it('consumes back only while the overlay covers the app', () => {
    expect(lockGateConsumesBack(true)).toBe(true);
    expect(lockGateConsumesBack(false)).toBe(false);
  });
});
