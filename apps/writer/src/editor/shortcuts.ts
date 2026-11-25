// Pure hardware-keyboard shortcut map (no react-native). `Mod` = Ctrl, or Cmd on macOS web.
export type ShortcutAction =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'undo'
  | 'redo'
  | 'find'
  | 'save'
  | 'preview'
  | 'shortcuts'
  | 'escape';

export interface KeyInput {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

export interface ShortcutDef {
  action: ShortcutAction;
  label: string;
  /** Each combo e.g. ['Mod','Shift','Z']; 'Mod' = Ctrl or Cmd. */
  combos: readonly (readonly string[])[];
}

export const SHORTCUTS: readonly ShortcutDef[] = [
  { action: 'bold', label: 'Bold', combos: [['Mod', 'B']] },
  { action: 'italic', label: 'Italic', combos: [['Mod', 'I']] },
  { action: 'underline', label: 'Underline', combos: [['Mod', 'U']] },
  { action: 'undo', label: 'Undo', combos: [['Mod', 'Z']] },
  {
    action: 'redo',
    label: 'Redo',
    combos: [
      ['Mod', 'Shift', 'Z'],
      ['Mod', 'Y'],
    ],
  },
  { action: 'find', label: 'Find & replace', combos: [['Mod', 'F']] },
  { action: 'save', label: 'Save now', combos: [['Mod', 'S']] },
  { action: 'preview', label: 'Live preview', combos: [['Mod', 'P']] },
  { action: 'shortcuts', label: 'Keyboard shortcuts', combos: [['Mod', '/']] },
  { action: 'escape', label: 'Close panel', combos: [['Escape']] },
];

const MODS: ReadonlySet<string> = new Set(['Mod', 'Shift']);

/** Matches one combo against a key press; `Mod` is Cmd on mac, Ctrl elsewhere. */
function comboMatches(combo: readonly string[], input: KeyInput, mac: boolean): boolean {
  if (input.alt) return false;
  const wantMod = combo.includes('Mod');
  const wantShift = combo.includes('Shift');
  const primary = mac ? input.meta : input.ctrl;
  const other = mac ? input.ctrl : input.meta;
  if (wantMod !== primary || other) return false;
  if (wantShift !== input.shift) return false;
  const key = combo.find((k) => !MODS.has(k));
  if (key === undefined) return false;
  return key.length === 1 ? input.key.toLowerCase() === key.toLowerCase() : input.key === key;
}

export function matchShortcut(input: KeyInput, mac: boolean): ShortcutAction | null {
  for (const def of SHORTCUTS) {
    if (def.combos.some((c) => comboMatches(c, input, mac))) return def.action;
  }
  return null;
}

/** True for Apple desktop platform strings (MacIntel, macOS, ...); false for iPhone/undefined. */
export function isMacPlatform(platform: string | undefined): boolean {
  return platform !== undefined && /^(mac|darwin)/i.test(platform.trim());
}

const MAC_GLYPH: Readonly<Record<string, string>> = { Mod: '⌘', Shift: '⇧' };

/** 'Ctrl+Shift+Z' on non-mac, '⌘⇧Z' on mac; 'Esc' for Escape. */
export function formatCombo(combo: readonly string[], mac: boolean): string {
  const name = (k: string): string => (k === 'Escape' ? 'Esc' : k);
  if (mac) return combo.map((k) => MAC_GLYPH[k] ?? name(k)).join('');
  return combo.map((k) => (k === 'Mod' ? 'Ctrl' : name(k))).join('+');
}
