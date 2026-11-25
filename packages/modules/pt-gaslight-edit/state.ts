// Pure scroll-back mutation state machine. No DOM: the renderer feeds it block rects.

/**
 * `data-kn-state` values.
 * - initial: initial text showing, not armed.
 * - armed: the reader is scrolled past the passage; whichever text is showing stays until return.
 * - mutated: mutated text showing, not armed.
 * With once:false the cycle is initial -> armed -> mutated -> armed -> initial -> ...
 */
export type GaslightPhase = 'initial' | 'armed' | 'mutated';

export interface GaslightState {
  phase: GaslightPhase;
  /** Which text is visible right now. */
  showing: 'initial' | 'mutated';
}

export interface StepInput {
  /** Block rect relative to the viewport top. */
  top: number;
  bottom: number;
  viewportH: number;
  scrollingUp: boolean;
}

export interface StepProps {
  triggerDistancePx: number;
  once: boolean;
}

export const initialState = (): GaslightState => ({ phase: 'initial', showing: 'initial' });

const flip = (s: GaslightState): GaslightState => {
  const showing = s.showing === 'initial' ? 'mutated' : 'initial';
  return { phase: showing, showing };
};

export function step(state: GaslightState, input: StepInput, props: StepProps): GaslightState {
  if (state.phase !== 'armed') {
    // Once-only modules are done after mutating; otherwise arm after a full pass.
    if (props.once && state.showing === 'mutated') return state;
    if (input.bottom < -props.triggerDistancePx) return { ...state, phase: 'armed' };
    return state;
  }
  // Swap while fully off-screen as soon as the reader heads back up.
  if (input.scrollingUp && input.bottom <= 0) return flip(state);
  // Fallback (jumps, scrollbar drags): swap on re-entry from above.
  if (input.bottom > 0 && input.top < input.viewportH) return flip(state);
  return state;
}
