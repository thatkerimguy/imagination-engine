import {
  beatsPerBarOf,
  sceneKey,
  SEQUENCE_LIMITS,
  sequenceClips,
  type SequenceDef,
} from '@ie/story';

/** One action at a beat, ready to dispatch. */
export interface SequenceCue {
  readonly beat: number;
  readonly action: string;
  readonly params: Readonly<Record<string, unknown>>;
}

export interface CompiledSequence {
  readonly id: string;
  /** Length in beats. */
  readonly length: number;
  readonly beatsPerBar: number;
  /** Sorted by beat; clips at the same beat keep track order. */
  readonly cues: readonly SequenceCue[];
}

/** Converts a sequence beat to seconds from its start. */
export type BeatTime = (beat: number) => number;

/** A steady tempo's beat-to-seconds conversion. */
export function steadyTime(bpm: number): BeatTime {
  const spb = 60 / bpm;
  return (beat) => beat * spb;
}

const TITLE_SECONDS = { min: 0.5, max: 20 } as const;
const RAMP_SECONDS = { min: 0, max: 30 } as const;

/**
 * Turns a sequence into cues sorted by beat (ADR 0019). Work that depends on the tempo, like a
 * title's seconds from its length on the timeline, happens here once, not while it plays.
 */
export function compileSequence(sequence: SequenceDef, time?: BeatTime): CompiledSequence {
  const at = time ?? steadyTime(sequence.bpm ?? SEQUENCE_LIMITS.bpm.default);
  const cues = sequenceClips(sequence).map((clip): SequenceCue => {
    const params = clip.params ?? {};
    const timed = clip.action === 'stage.title' || clip.action === 'stage.material.param';
    if (!timed || !clip.length) return { beat: clip.at, action: clip.action, params };
    const seconds = at(clip.at + clip.length) - at(clip.at);
    // A title stays up for its length; a parameter ramps over it (ADR 0020).
    const range = clip.action === 'stage.title' ? TITLE_SECONDS : RAMP_SECONDS;
    const clamped = Math.min(range.max, Math.max(range.min, seconds));
    return { beat: clip.at, action: clip.action, params: { ...params, seconds: clamped } };
  });
  return { id: sequence.id, length: sequence.length, beatsPerBar: beatsPerBarOf(sequence), cues };
}

/**
 * The scene state in force at `beat`: the last `.set` cue of each kind at or before it, so a
 * scrub or a jump shows the right background and look without replaying the moments before it.
 */
export function sceneAt(compiled: CompiledSequence, beat: number): SequenceCue[] {
  const last = new Map<string, SequenceCue>();
  for (const cue of compiled.cues) {
    if (cue.beat > beat) break;
    if (cue.action.endsWith('.set')) last.set(sceneKey(cue.action, cue.params), cue);
  }
  return [...last.values()];
}
