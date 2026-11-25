// Android nav-bar icon appearance (Gate 1 cosmetic fix): dark 3-button / gesture icons while a
// light Folio theme is showing, light icons on dark themes and the dark Preview theater. Calls
// the KnInput native module (plugins/android-input.js); a no-op on web, iOS and Expo Go.
// Screens stack: the most recently mounted caller wins, and unmounting restores the one below.
import { useEffect, useRef } from 'react';
import { NativeModules, Platform } from 'react-native';

interface KnInputNative {
  setLightNavigationBars(light: boolean): void;
}

interface Entry {
  light: boolean;
}

const stack: Entry[] = [];

function apply(): void {
  if (Platform.OS !== 'android') return;
  const native = (NativeModules as { KnInput?: KnInputNative }).KnInput;
  const top = stack[stack.length - 1];
  if (top && typeof native?.setLightNavigationBars === 'function') {
    native.setLightNavigationBars(top.light);
  }
}

/** Requests light (dark-icon) or dark (light-icon) navigation-bar appearance while mounted. */
export function useNavigationBarStyle(light: boolean): void {
  const entry = useRef<Entry>({ light });
  useEffect(() => {
    const e = entry.current;
    stack.push(e);
    apply();
    return () => {
      const i = stack.indexOf(e);
      if (i >= 0) stack.splice(i, 1);
      apply();
    };
  }, []);
  useEffect(() => {
    entry.current.light = light;
    apply();
  }, [light]);
}
