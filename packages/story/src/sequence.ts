import { z } from 'zod';

/*
 * Sequences (ADR 0019): tracks of clips placed in beats. A clip is the same action and params an
 * Action block has; a notes track holds fight notes. Data only: @ie/sequencer plays it and
 * @ie/rhythm turns move sequences and charts into fight notes.
 */

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'IDs use letters, digits and _');
const label = z.object({ en: z.string().optional(), tr: z.string().optional() });

export const SEQUENCE_KINDS = ['scene', 'move'] as const;
export type SequenceKind = (typeof SEQUENCE_KINDS)[number];

export const TRACK_KINDS = ['stage', 'text', 'sound', 'notes'] as const;
export type TrackKind = (typeof TRACK_KINDS)[number];
export type ClipTrackKind = Exclude<TrackKind, 'notes'>;

/** How the reader answers a note: parry and dodge answer the enemy, strike hits it. */
export const NOTE_KINDS = ['parry', 'dodge', 'strike'] as const;
export type SequenceNoteKind = (typeof NOTE_KINDS)[number];

/** The actions each kind of track can hold. Nothing that changes the story's state. */
export const TRACK_ACTIONS = {
  stage: [
    'stage.background.set',
    'stage.look.set',
    'stage.shake',
    'stage.flash',
    'stage.hitstop',
    'stage.burst',
    'stage.transition',
  ],
  text: ['stage.title'],
  sound: ['audio.sfx.play', 'audio.ambience.set'],
} as const satisfies Record<ClipTrackKind, readonly string[]>;

export const SEQUENCE_LIMITS = {
  /** A scene's length in bars. */
  bars: { min: 1, max: 64, default: 4 },
  /** A move's length in beats. */
  moveBeats: { min: 1, max: 8, default: 2 },
  /** Tempo when a scene has no song with a beat grid. */
  bpm: { min: 40, max: 240, default: 100 },
  beatsPerBar: { min: 2, max: 12, default: 4 },
  tracks: 16,
  clips: 256,
} as const;

/** Furthest a clip may start, in beats (64 bars of 12). */
const MAX_BEAT = 768;
const beat = z.number().min(0).max(MAX_BEAT);

export interface SequenceClip {
  readonly id: string;
  /** Beats from the start of the sequence. */
  readonly at: number;
  /** Beats it lasts; sets a title's time on screen. Moments without one take no room. */
  readonly length?: number;
  readonly action: string;
  readonly params?: Readonly<Record<string, unknown>>;
}
export const sequenceClipSchema = z.object({
  id,
  at: beat,
  length: z.number().positive().max(MAX_BEAT).optional(),
  action: z.string().regex(/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/),
  params: z.record(z.string(), z.unknown()).optional(),
});

export interface SequenceNote {
  readonly id: string;
  readonly at: number;
  readonly kind: SequenceNoteKind;
  /** Multiplies the enemy's attack when this note gets through. */
  readonly power?: number;
  /** Where the note sits on the stage, 0–1 across and down; the fight picks one without it. */
  readonly x?: number;
  readonly y?: number;
}
const unit = z.number().min(0).max(1);
export const sequenceNoteSchema = z.object({
  id,
  at: beat,
  kind: z.enum(NOTE_KINDS),
  power: z.number().min(0.25).max(4).optional(),
  x: unit.optional(),
  y: unit.optional(),
});

export type SequenceTrack =
  | {
      readonly id: string;
      readonly kind: ClipTrackKind;
      readonly muted?: boolean;
      readonly clips: readonly SequenceClip[];
    }
  | {
      readonly id: string;
      readonly kind: 'notes';
      readonly muted?: boolean;
      readonly notes: readonly SequenceNote[];
    };
export const sequenceTrackSchema = z.discriminatedUnion('kind', [
  z.object({
    id,
    kind: z.enum(['stage', 'text', 'sound']),
    muted: z.boolean().optional(),
    clips: z.array(sequenceClipSchema).max(SEQUENCE_LIMITS.clips),
  }),
  z.object({
    id,
    kind: z.literal('notes'),
    muted: z.boolean().optional(),
    notes: z.array(sequenceNoteSchema).max(SEQUENCE_LIMITS.clips),
  }),
]);

export interface SequenceDef {
  readonly id: string;
  readonly kind: SequenceKind;
  readonly name: { readonly en?: string; readonly tr?: string };
  /** The song a scene follows (an audio-library track). */
  readonly track?: string;
  /** Tempo without a song that has a beat grid. */
  readonly bpm?: number;
  readonly beatsPerBar?: number;
  /** Length in beats. */
  readonly length: number;
  readonly tracks: readonly SequenceTrack[];
}
export const sequenceSchema = z.object({
  id,
  kind: z.enum(SEQUENCE_KINDS),
  name: label,
  track: id.optional(),
  bpm: z.number().min(SEQUENCE_LIMITS.bpm.min).max(SEQUENCE_LIMITS.bpm.max).optional(),
  beatsPerBar: z
    .number()
    .int()
    .min(SEQUENCE_LIMITS.beatsPerBar.min)
    .max(SEQUENCE_LIMITS.beatsPerBar.max)
    .optional(),
  length: z.number().positive().max(MAX_BEAT),
  tracks: z.array(sequenceTrackSchema).max(SEQUENCE_LIMITS.tracks),
});

/** The Sequence block: plays a sequence, and by default waits until it ends (ADR 0019). */
export interface SequenceBlock {
  readonly id: string;
  readonly type: 'sequence';
  readonly sequence: string;
  /** False: the story goes on while it plays. */
  readonly wait?: boolean;
}
export const sequenceBlockSchema = z.object({
  id,
  type: z.literal('sequence'),
  sequence: z.union([id, z.literal('')]),
  wait: z.boolean().optional(),
});

export function beatsPerBarOf(sequence: SequenceDef): number {
  return sequence.beatsPerBar ?? SEQUENCE_LIMITS.beatsPerBar.default;
}

/** Whether a track kind can hold an action. */
export function trackAllows(kind: ClipTrackKind, action: string): boolean {
  return (TRACK_ACTIONS[kind] as readonly string[]).includes(action);
}

/** Every note on the sequence's unmuted notes tracks, in beat order. */
export function sequenceNotes(sequence: SequenceDef): SequenceNote[] {
  const notes: SequenceNote[] = [];
  for (const track of sequence.tracks)
    if (track.kind === 'notes' && !track.muted) notes.push(...track.notes);
  return notes.sort((a, b) => a.at - b.at);
}

/** Every clip on the sequence's unmuted clip tracks, in beat order (track order breaks ties). */
export function sequenceClips(sequence: SequenceDef): SequenceClip[] {
  const clips: SequenceClip[] = [];
  for (const track of sequence.tracks)
    if (track.kind !== 'notes' && !track.muted) clips.push(...track.clips);
  // Array.prototype.sort is stable, so clips at the same beat keep track order.
  return clips.sort((a, b) => a.at - b.at);
}

/** The scene-state actions (`.set`) a sequence leaves in force, in the order they apply. */
export function sequenceSceneChanges(sequence: SequenceDef): SequenceClip[] {
  return sequenceClips(sequence).filter((c) => c.action.endsWith('.set'));
}
