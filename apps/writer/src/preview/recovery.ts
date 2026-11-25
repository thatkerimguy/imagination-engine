// Pure retry policy for the preview WebView's renderer process. Android's Low Memory Killer or a
// WebView update can kill the isolated Chromium renderer at any time; we remount the WebView a
// few times, but a renderer that keeps dying inside the window falls back to a manual reload so
// the screen can never crash-loop.

export const MAX_RECOVERIES = 3;
export const RECOVERY_WINDOW_MS = 30_000;
/** Short tick before remounting, so the dead view is fully torn down first. */
export const REMOUNT_DELAY_MS = 250;

export interface RecoveryState {
  /** Timestamps of renderer deaths that are still inside the window. */
  readonly crashes: readonly number[];
  /** Bumped on every remount; used as the WebView's React key. */
  readonly generation: number;
  readonly gaveUp: boolean;
}

export type RecoveryAction = 'remount' | 'give-up';

export const initialRecovery: RecoveryState = { crashes: [], generation: 0, gaveUp: false };

/** Records a renderer death at `now` and says whether to remount or show the fallback. */
export function recordRendererGone(
  state: RecoveryState,
  now: number,
): { state: RecoveryState; action: RecoveryAction } {
  const crashes = [...state.crashes.filter((t) => now - t < RECOVERY_WINDOW_MS), now];
  if (crashes.length > MAX_RECOVERIES) {
    return { state: { ...state, crashes, gaveUp: true }, action: 'give-up' };
  }
  return {
    state: { crashes, generation: state.generation + 1, gaveUp: false },
    action: 'remount',
  };
}

/** The author tapped "Reload preview": start a fresh budget with a new WebView. */
export function manualReload(state: RecoveryState): RecoveryState {
  return { crashes: [], generation: state.generation + 1, gaveUp: false };
}

/** Telemetry line for a renderer death. Never includes chapter prose or titles. */
export function recoveryLog(
  didCrash: boolean,
  action: RecoveryAction,
  state: RecoveryState,
): string {
  const cause = didCrash ? 'crashed' : 'killed (low memory)';
  return `[writer] preview renderer ${cause}; ${action} (${state.crashes.length}/${MAX_RECOVERIES} in ${RECOVERY_WINDOW_MS / 1000}s, gen ${state.generation})`;
}
