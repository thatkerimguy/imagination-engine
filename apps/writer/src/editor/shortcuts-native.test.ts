// The Android Meta+/ Keyboard Shortcuts Helper list (plugins/android-input.js) must mirror the
// JS shortcut table: same labels, same Ctrl combos, and every one dispatches through matchShortcut.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { matchShortcut, nativeKeyInput, SHORTCUTS } from './shortcuts.ts';

interface HelperRow {
  label: string;
  key: string;
  shift: boolean;
}

const require = createRequire(import.meta.url);
const { HELPER_SHORTCUTS, ESCAPE_KEY, moduleKt } = require('../../plugins/android-input.js') as {
  HELPER_SHORTCUTS: HelperRow[];
  ESCAPE_KEY: string;
  moduleKt: (pkg: string) => string;
};

const keyOf = (k: string): string => (k === 'SLASH' ? '/' : k.toLowerCase());

describe('Android Meta+/ helper parity', () => {
  it('lists every Ctrl shortcut with its JS label', () => {
    const fromJs = SHORTCUTS.filter((d) => d.action !== 'escape').flatMap((d) =>
      d.combos.map((c) => `${d.label}|${c.includes('Shift')}|${c[c.length - 1]!.toLowerCase()}`),
    );
    const fromNative = HELPER_SHORTCUTS.map((r) => `${r.label}|${r.shift}|${keyOf(r.key)}`);
    expect(fromNative.sort()).toEqual(fromJs.sort());
  });

  it('every helper row dispatches through matchShortcut as the bridge emits it', () => {
    for (const r of HELPER_SHORTCUTS) {
      const input = { key: keyOf(r.key), ctrl: true, meta: false, shift: r.shift, alt: false };
      const action = matchShortcut(input, false);
      expect(SHORTCUTS.find((d) => d.action === action)?.label).toBe(r.label);
    }
  });

  it('forwards plain hardware Escape (keycode 111) as the escape shortcut', () => {
    const kt = moduleKt('com.example');
    expect(kt).toContain('KeyEvent.KEYCODE_ESCAPE');
    expect(kt).toContain(`emit("${ESCAPE_KEY}", ctrl = false, shift = false)`);
    const input = nativeKeyInput({ key: ESCAPE_KEY, ctrl: false, shift: false });
    expect(input && matchShortcut(input, false)).toBe('escape');
    // Ctrl payloads (and legacy payloads without `ctrl`) still match Ctrl shortcuts only.
    expect(matchShortcut(nativeKeyInput({ key: 'f' })!, false)).toBe('find');
    expect(matchShortcut(nativeKeyInput({ key: ESCAPE_KEY })!, false)).toBeNull();
  });
});
