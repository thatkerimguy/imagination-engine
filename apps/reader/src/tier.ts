import type { QualityTier } from '@kn/core/renderer';
import type { TierPreference } from './prefs.ts';

export interface DeviceHints {
  reducedMotion: boolean;
  saveData?: boolean;
  deviceMemory?: number;
  cores?: number;
}

/** Explicit reader choice wins, except that the OS reduced-motion setting is always honoured. */
export function resolveTier(pref: TierPreference, hints: DeviceHints): QualityTier {
  if (hints.reducedMotion) return 'reduced';
  if (pref !== 'auto') return pref;
  if (hints.saveData) return 'lite';
  if ((hints.deviceMemory ?? 4) <= 2 || (hints.cores ?? 4) <= 2) return 'lite';
  return 'high';
}

export function deviceHints(): DeviceHints {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return {
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: nav.connection?.saveData,
    deviceMemory: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
  };
}
