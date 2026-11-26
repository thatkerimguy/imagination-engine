// Native hardware-keyboard bridge: MainActivity hands Ctrl+<key> presses to JS as "knShortcut"
// device events while capture is on (plugins/android-input.js), plus plain Escape (ctrl: false),
// which closes the top panel (sheet -> popover -> Find) exactly as on web / iPad.
import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import { nativeKeyInput, type KeyInput } from './shortcuts.ts';

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
    (e: { key?: unknown; ctrl?: unknown; shift?: unknown }) => {
      const input = nativeKeyInput(e);
      if (input) handler(input, false);
    },
  );
  return () => {
    sub.remove();
    native.setShortcutCapture(false);
  };
}
