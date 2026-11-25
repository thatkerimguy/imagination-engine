// Tracks "should this module be doing work right now": false while the page is hidden or the host
// (writer app) reported `kn:lifecycle` with `detail.active === false`. Modules cannot import reader
// code, so the raw event name is repeated here. Torn down by the AbortSignal.
export const LIFECYCLE_EVENT = 'kn:lifecycle';

export interface PauseGate {
  readonly paused: boolean;
}

export interface GateEnv {
  doc?: Partial<EventTarget> & { readonly hidden?: boolean };
  win?: Partial<EventTarget>;
}

export function createPauseGate(
  signal: AbortSignal,
  onChange?: (paused: boolean) => void,
  env: GateEnv = { doc: globalThis.document, win: globalThis.window },
): PauseGate {
  let appActive = true;
  const hidden = (): boolean => env.doc?.hidden === true;
  let last = hidden();
  const sync = (): void => {
    const now = !appActive || hidden();
    if (now === last) return;
    last = now;
    if (!signal.aborted) onChange?.(now);
  };
  if (!signal.aborted) {
    env.doc?.addEventListener?.('visibilitychange', sync, { signal });
    env.win?.addEventListener?.(
      LIFECYCLE_EVENT,
      (e) => {
        const detail = (e as CustomEvent<{ active?: unknown }>).detail;
        appActive = detail?.active !== false;
        sync();
      },
      { signal },
    );
  }
  return {
    get paused() {
      return !appActive || hidden();
    },
  };
}
