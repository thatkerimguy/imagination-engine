/*
 * Reduced motion (ADR 0022). The reader can follow the system setting or override it in the app;
 * every package asks here instead of reading the media query itself.
 */

export type MotionPreference = 'system' | 'reduce' | 'full';

const EVENT = 'ie:motion';

function query(): MediaQueryList | null {
  return typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
}

/** Whether animation should be kept to the minimum right now. */
export function prefersReducedMotion(): boolean {
  const pref =
    typeof document === 'undefined' ? undefined : document.documentElement.dataset.motion;
  if (pref === 'reduce') return true;
  if (pref === 'full') return false;
  return query()?.matches ?? false;
}

/** Sets the app's own preference (on `<html data-motion>`, which CSS reads too). */
export function setMotionPreference(pref: MotionPreference): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.motion;
  else root.dataset.motion = pref;
  document.dispatchEvent(new Event(EVENT));
}

/** Calls `listener` whenever the answer of prefersReducedMotion() may have changed. */
export function watchReducedMotion(listener: (reduce: boolean) => void): () => void {
  const fire = () => listener(prefersReducedMotion());
  const mq = query();
  mq?.addEventListener('change', fire);
  if (typeof document !== 'undefined') document.addEventListener(EVENT, fire);
  return () => {
    mq?.removeEventListener('change', fire);
    if (typeof document !== 'undefined') document.removeEventListener(EVENT, fire);
  };
}
