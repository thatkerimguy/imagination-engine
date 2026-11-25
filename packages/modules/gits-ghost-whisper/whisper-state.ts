// Pure reveal logic: tilt hysteresis and the hold/tilt/toggle reducer. No DOM.

export const EXIT_RATIO = 0.65;

export interface TiltState {
  baseBeta: number | null;
  baseGamma: number | null;
  active: boolean;
}

export const initialTilt = (): TiltState => ({ baseBeta: null, baseGamma: null, active: false });

/** Smallest absolute difference between two angles in degrees (handles 359 -> 1 wrap). */
export function angleDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function tiltDelta(state: TiltState, beta: number, gamma: number): number {
  if (state.baseBeta === null || state.baseGamma === null) return 0;
  return Math.max(angleDelta(beta, state.baseBeta), angleDelta(gamma, state.baseGamma));
}

/** Feeds one orientation reading. The first reading becomes the baseline. */
export function stepTilt(
  state: TiltState,
  beta: number,
  gamma: number,
  thresholdDeg: number,
): TiltState {
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return state;
  if (state.baseBeta === null || state.baseGamma === null) {
    return { baseBeta: beta, baseGamma: gamma, active: false };
  }
  const delta = tiltDelta(state, beta, gamma);
  const active = state.active ? delta > thresholdDeg * EXIT_RATIO : delta >= thresholdDeg;
  return active === state.active ? state : { ...state, active };
}

/** Re-baselines on the next reading (and drops any tilt reveal). */
export const rebaseline = (): TiltState => initialTilt();

export interface RevealState {
  hold: boolean;
  tilt: boolean;
  toggled: boolean;
}

export type RevealEvent =
  { type: 'hold'; on: boolean } | { type: 'tilt'; on: boolean } | { type: 'toggle' };

export const initialReveal = (): RevealState => ({ hold: false, tilt: false, toggled: false });

export function reduceReveal(state: RevealState, event: RevealEvent): RevealState {
  switch (event.type) {
    case 'hold':
      return state.hold === event.on ? state : { ...state, hold: event.on };
    case 'tilt':
      return state.tilt === event.on ? state : { ...state, tilt: event.on };
    case 'toggle':
      return { ...state, toggled: !state.toggled };
  }
}

export const isRevealed = (s: RevealState): boolean => s.hold || s.tilt || s.toggled;
