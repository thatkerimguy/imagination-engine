// Native hardware-keyboard bridge: MainActivity hands Ctrl+<key> presses to JS as "knShortcut"
// device events while capture is on (plugins/android-input.js). Escape needs no bridge on
// Android: the system maps it to Back, which the editor's back layers already handle.
import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import type { KeyInput } from './shortcuts.ts';

interface KnInputNative {
  setShortcutCapture(enabled: boolean): void;
}

/** Calls `handler` for each shortcut-key press; returns the unsubscribe. */
export function subscribeKeys(handler: (input: KeyInput, mac: boolean) => boolean): () => void {
  const native = (NativeModules as { KnInput?: KnInputNative }).KnInput;
  if (Platform.OS !== 'android' || typeof native?.setShortcutCapture !== 'function') {
    return () => undefined;
  }
  native.setShortcutCapture(true);
  const sub = DeviceEventEmitter.addListener(
    'knShortcut',
    (e: { key?: unknown; shift?: unknown }) => {
      if (typeof e.key !== 'string') return;
      handler({ key: e.key, ctrl: true, meta: false, shift: e.shift === true, alt: false }, false);
    },
  );
  return () => {
    sub.remove();
    native.setShortcutCapture(false);
  };
}
