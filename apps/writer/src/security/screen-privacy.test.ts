import { describe, expect, it } from 'vitest';
import { hideInRecentsSetting, shouldBlockScreenCapture } from './screen-privacy.ts';

const base = {
  isLocked: false,
  onSensitiveScreen: false,
  lockEnabled: false,
  hideInRecents: false,
};

describe('shouldBlockScreenCapture', () => {
  it('always blocks while locked or on a PIN / recovery screen', () => {
    expect(shouldBlockScreenCapture({ ...base, isLocked: true })).toBe(true);
    expect(shouldBlockScreenCapture({ ...base, onSensitiveScreen: true })).toBe(true);
  });

  it('blocks manuscripts only with Master Lock on and Hide in app switcher on', () => {
    expect(shouldBlockScreenCapture({ ...base, lockEnabled: true, hideInRecents: true })).toBe(
      true,
    );
    expect(shouldBlockScreenCapture({ ...base, lockEnabled: true })).toBe(false);
    expect(shouldBlockScreenCapture({ ...base, hideInRecents: true })).toBe(false);
    expect(shouldBlockScreenCapture(base)).toBe(false);
  });
});

describe('hideInRecentsSetting', () => {
  it('defaults on with Master Lock and off without it', () => {
    expect(hideInRecentsSetting({ enabled: true })).toBe(true);
    expect(hideInRecentsSetting({ enabled: true, hideInRecents: false })).toBe(false);
    expect(hideInRecentsSetting({ enabled: false, hideInRecents: true })).toBe(false);
    expect(hideInRecentsSetting(null)).toBe(false);
    expect(hideInRecentsSetting(undefined)).toBe(false);
  });
});
