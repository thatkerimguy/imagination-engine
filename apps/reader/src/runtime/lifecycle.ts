// Host (writer app) foreground/background state. The preview view dispatches `kn:lifecycle`
// on window; modules listen for the same raw string event (they cannot import reader code).
export const LIFECYCLE_EVENT = 'kn:lifecycle';

let active = true;

export function isAppActive(): boolean {
  return active;
}

export function dispatchLifecycle(next: boolean): void {
  active = next;
  window.dispatchEvent(new CustomEvent(LIFECYCLE_EVENT, { detail: { active: next } }));
}

/** Calls `cb` on every lifecycle change; removed when `signal` aborts. */
export function onLifecycle(cb: (active: boolean) => void, signal?: AbortSignal): void {
  window.addEventListener(
    LIFECYCLE_EVENT,
    (e) => cb((e as CustomEvent<{ active: boolean }>).detail.active),
    {
      signal,
    },
  );
}
