// Module-scoped registry of the one flame that may be lit at a time. Cleared on dispose so
// nothing leaks across chapters.
import type { AudioBusAccess } from '@kn/core/renderer';

export interface LiveFlame {
  /** Plays the lid clack (when `audio` is given), fades out, removes nodes. */
  extinguish(audio: AudioBusAccess | null): Promise<void>;
  /** Immediate, silent removal. Idempotent. */
  remove(): void;
}

let active: LiveFlame | null = null;

/** Makes `flame` the lit one; any previous flame vanishes instantly and silently. */
export function register(flame: LiveFlame): void {
  if (active && active !== flame) active.remove();
  active = flame;
}

export function unregister(flame: LiveFlame): void {
  if (active === flame) active = null;
}

export function hasActiveFlame(): boolean {
  return active !== null;
}

export function extinguishFlame(flame: LiveFlame, audio: AudioBusAccess | null): Promise<void> {
  unregister(flame);
  return flame.extinguish(audio);
}

/** No-op (no sound) when nothing is lit. */
export async function extinguishActive(audio: AudioBusAccess | null): Promise<void> {
  if (active) await extinguishFlame(active, audio);
}
