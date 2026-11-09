/**
 * Per-device UI preferences (theme, language, HUD). localStorage can throw or be missing in private
 * windows, so every access is guarded and the app must work without it.
 */
export function readPref(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage unavailable: the preference simply won't persist.
  }
}

export function removePref(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Ignore.
  }
}
