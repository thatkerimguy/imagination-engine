import { describe, expect, it } from 'vitest';
import {
  formatCombo,
  isMacPlatform,
  matchShortcut,
  SHORTCUTS,
  type KeyInput,
} from './shortcuts.ts';

const k = (key: string, o: Partial<KeyInput> = {}): KeyInput => ({
  key,
  ctrl: false,
  meta: false,
  shift: false,
  alt: false,
  ...o,
});

describe('matchShortcut (non-mac, Ctrl)', () => {
  it('maps the primary bindings', () => {
    expect(matchShortcut(k('b', { ctrl: true }), false)).toBe('bold');
    expect(matchShortcut(k('i', { ctrl: true }), false)).toBe('italic');
    expect(matchShortcut(k('u', { ctrl: true }), false)).toBe('underline');
    expect(matchShortcut(k('z', { ctrl: true }), false)).toBe('undo');
    expect(matchShortcut(k('f', { ctrl: true }), false)).toBe('find');
    expect(matchShortcut(k('s', { ctrl: true }), false)).toBe('save');
    expect(matchShortcut(k('p', { ctrl: true }), false)).toBe('preview');
    expect(matchShortcut(k('/', { ctrl: true }), false)).toBe('shortcuts');
  });
  it('supports both redo bindings and uppercase letters', () => {
    expect(matchShortcut(k('z', { ctrl: true, shift: true }), false)).toBe('redo');
    expect(matchShortcut(k('Z', { ctrl: true, shift: true }), false)).toBe('redo');
    expect(matchShortcut(k('y', { ctrl: true }), false)).toBe('redo');
    expect(matchShortcut(k('B', { ctrl: true }), false)).toBe('bold');
  });
  it('rejects Cmd/meta on non-mac and plain letters', () => {
    expect(matchShortcut(k('b', { meta: true }), false)).toBeNull();
    expect(matchShortcut(k('b', { ctrl: true, meta: true }), false)).toBeNull();
    expect(matchShortcut(k('b'), false)).toBeNull();
  });
});

describe('matchShortcut (mac, Cmd)', () => {
  it('uses meta as the primary modifier', () => {
    expect(matchShortcut(k('b', { meta: true }), true)).toBe('bold');
    expect(matchShortcut(k('z', { meta: true, shift: true }), true)).toBe('redo');
    expect(matchShortcut(k('/', { meta: true }), true)).toBe('shortcuts');
  });
  it('rejects Ctrl on mac', () => {
    expect(matchShortcut(k('b', { ctrl: true }), true)).toBeNull();
    expect(matchShortcut(k('b', { ctrl: true, meta: true }), true)).toBeNull();
  });
});

describe('matchShortcut edge rules', () => {
  it('rejects shift where the binding has none', () => {
    expect(matchShortcut(k('b', { ctrl: true, shift: true }), false)).toBeNull();
    expect(matchShortcut(k('y', { ctrl: true, shift: true }), false)).toBeNull();
  });
  it('rejects shift-less Mod+Z as redo and requires shift for it', () => {
    expect(matchShortcut(k('z', { ctrl: true }), false)).toBe('undo');
  });
  it('rejects any alt', () => {
    expect(matchShortcut(k('b', { ctrl: true, alt: true }), false)).toBeNull();
    expect(matchShortcut(k('Escape', { alt: true }), false)).toBeNull();
  });
  it('matches Escape only without modifiers', () => {
    expect(matchShortcut(k('Escape'), false)).toBe('escape');
    expect(matchShortcut(k('Escape', { ctrl: true }), false)).toBeNull();
    expect(matchShortcut(k('Escape', { shift: true }), true)).toBeNull();
    expect(matchShortcut(k('Escape', { meta: true }), true)).toBeNull();
  });
  it('does not treat ? as the shortcuts key, and ignores unknown keys', () => {
    expect(matchShortcut(k('?', { ctrl: true }), false)).toBeNull();
    expect(matchShortcut(k('q', { ctrl: true }), false)).toBeNull();
    expect(matchShortcut(k('Enter'), false)).toBeNull();
  });
});

describe('SHORTCUTS table', () => {
  it('has the agreed labels', () => {
    expect(SHORTCUTS.map((s) => s.label)).toEqual([
      'Bold',
      'Italic',
      'Underline',
      'Undo',
      'Redo',
      'Find & replace',
      'Save now',
      'Live preview',
      'Keyboard shortcuts',
      'Close panel',
    ]);
  });
  it.each([false, true])('every combo resolves to its own action (mac=%s)', (mac) => {
    for (const def of SHORTCUTS) {
      for (const combo of def.combos) {
        const key = combo.find((c) => c !== 'Mod' && c !== 'Shift')!;
        const input = k(key, {
          ctrl: !mac && combo.includes('Mod'),
          meta: mac && combo.includes('Mod'),
          shift: combo.includes('Shift'),
        });
        expect(matchShortcut(input, mac)).toBe(def.action);
      }
    }
  });
});

describe('formatCombo', () => {
  it('formats non-mac with Ctrl and +', () => {
    expect(formatCombo(['Mod', 'Shift', 'Z'], false)).toBe('Ctrl+Shift+Z');
    expect(formatCombo(['Mod', '/'], false)).toBe('Ctrl+/');
    expect(formatCombo(['Escape'], false)).toBe('Esc');
  });
  it('formats mac with glyphs', () => {
    expect(formatCombo(['Mod', 'Shift', 'Z'], true)).toBe('⌘⇧Z');
    expect(formatCombo(['Mod', 'B'], true)).toBe('⌘B');
    expect(formatCombo(['Escape'], true)).toBe('Esc');
  });
});

describe('isMacPlatform', () => {
  it('detects Apple desktops only', () => {
    expect(isMacPlatform('MacIntel')).toBe(true);
    expect(isMacPlatform('macOS')).toBe(true);
    expect(isMacPlatform('iPhone')).toBe(false);
    expect(isMacPlatform('Win32')).toBe(false);
    expect(isMacPlatform('Linux armv8l')).toBe(false);
    expect(isMacPlatform(undefined)).toBe(false);
  });
});
