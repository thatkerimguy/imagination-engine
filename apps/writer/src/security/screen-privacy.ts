// When Android FLAG_SECURE (blank screenshots, screen recordings and the Recents thumbnail) is on.
// Pure so it is unit-tested; use-screen-privacy.ts applies it through expo-screen-capture.

export interface ScreenPrivacyInput {
  /** The Master Lock overlay is covering the app right now. */
  isLocked: boolean;
  /** A PIN pad, PIN setup or recovery code is on screen. */
  onSensitiveScreen: boolean;
  lockEnabled: boolean;
  /** "Hide in app switcher" (effective value: see hideInRecentsSetting). */
  hideInRecents: boolean;
}

/**
 * Locked overlays and PIN / recovery screens are always protected. Otherwise manuscripts are
 * hidden from Recents and screenshots only for authors who use Master Lock and kept
 * "Hide in app switcher" on; without Master Lock the writer screenshots freely.
 */
export function shouldBlockScreenCapture(p: ScreenPrivacyInput): boolean {
  if (p.isLocked || p.onSensitiveScreen) return true;
  return p.lockEnabled && p.hideInRecents;
}

/** Stored preference → effective value: defaults on with Master Lock, always off without it. */
export function hideInRecentsSetting(
  config: { enabled: boolean; hideInRecents?: boolean } | null | undefined,
): boolean {
  if (!config?.enabled) return false;
  return config.hideInRecents ?? true;
}

/** Tags for expo-screen-capture; each hook instance adds a unique suffix. */
export const PRIVACY_TAG = {
  gate: 'kn-lock-gate',
  pin: 'kn-pin',
  recovery: 'kn-recovery-code',
} as const;
