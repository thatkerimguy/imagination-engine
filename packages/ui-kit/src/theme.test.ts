import { describe, expect, it } from 'vitest';
import { readPref, writePref } from './prefs.ts';
import { isThemePreference, resolveTheme } from './theme.ts';

describe('theme', () => {
  it('resolves system preference', () => {
    expect(resolveTheme('system', true)).toBe('night');
    expect(resolveTheme('system', false)).toBe('paper');
    expect(resolveTheme('night', false)).toBe('night');
  });

  it('validates stored preferences', () => {
    expect(isThemePreference('paper')).toBe(true);
    expect(isThemePreference('sepia')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});

describe('prefs', () => {
  it('works without localStorage', () => {
    expect(readPref('anything')).toBeNull();
    expect(() => writePref('anything', 'x')).not.toThrow();
  });
});
