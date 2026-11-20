// localStorage can throw (private mode, quota, disabled storage). Reader progress is a
// convenience, never a requirement, so every access degrades to "nothing saved".
export function readJson<T>(key: string, isValid: (v: unknown) => v is T): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    return isValid(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: progress simply isn't remembered.
  }
}
