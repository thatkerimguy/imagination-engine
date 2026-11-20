// The settle → hold → fade handoff shared by the high and lite tiers. Settled dice stay readable
// for a moment, then clear the prose while the inline result chip fades in.

/** Seconds the overlay takes to fade out while the inline chip fades in (matches styles.ts). */
export const FADE_SECONDS = 0.45;

/**
 * Resolves after `seconds`, or as soon as the reader taps anywhere. The listener and timer are
 * removed on whichever comes first, and on `signal` abort (navigation, dispose).
 */
export function holdOrTap(seconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const local = new AbortController();
    const done = (): void => {
      clearTimeout(timer);
      local.abort();
      resolve();
    };
    const timer = window.setTimeout(done, seconds * 1000);
    // Registered on the next frame so the tap that started a tap-to-throw cannot also skip it.
    requestAnimationFrame(() => {
      if (local.signal.aborted) return;
      window.addEventListener('pointerdown', done, { once: true, signal: local.signal });
    });
    signal.addEventListener('abort', done, { signal: local.signal });
  });
}

/** Smoothstep 0→1 over the fade, from `start` (seconds) at time `t`. */
export function fadeProgress(t: number, start: number): number {
  const k = Math.min(1, Math.max(0, (t - start) / FADE_SECONDS));
  return k * k * (3 - 2 * k);
}

/** Contact-shadow strength by height above the page: soft and faint in the air, firm on landing. */
export function shadowFor(height: number): { opacity: number; scale: number; offset: number } {
  const h = Math.max(0, height);
  return { opacity: 0.5 / (1 + h * 1.4), scale: 1.25 + h * 0.55, offset: h * 0.45 };
}
