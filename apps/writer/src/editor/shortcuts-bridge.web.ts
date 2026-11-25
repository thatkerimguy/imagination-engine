// Web hardware-keyboard bridge: one capture-phase window keydown listener while the editor is
// focused (capture, because the focused prose TextInput stops keydown propagation). Handled
// shortcuts suppress the browser default (Ctrl/Cmd+S save page, +P print, +F find).
import type { KeyInput } from './shortcuts.ts';
import { isMacPlatform } from './shortcuts.ts';

export function subscribeKeys(handler: (input: KeyInput, mac: boolean) => boolean): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const mac = isMacPlatform(typeof navigator === 'undefined' ? undefined : navigator.platform);
  const onKey = (e: KeyboardEvent): void => {
    if (e.repeat || e.isComposing) return;
    const input = {
      key: e.key,
      ctrl: e.ctrlKey,
      meta: e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
    };
    if (handler(input, mac)) e.preventDefault();
  };
  window.addEventListener('keydown', onKey, true);
  return () => window.removeEventListener('keydown', onKey, true);
}
