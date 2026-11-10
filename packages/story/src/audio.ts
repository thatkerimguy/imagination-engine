import { z } from 'zod';

/*
 * The novel's sound: tracks with their beat analysis, sound effects stored as sfxr presets, and
 * character voices. This is data only; @ie/audio plays it.
 */

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'IDs use letters, digits and _');

/** Where a track's audio comes from. Tier A sources give raw audio; Spotify and YouTube don't. */
export type TrackSource =
  | { readonly kind: 'file'; readonly path: string; readonly mime?: string }
  | {
      readonly kind: 'url';
      readonly url: string;
      readonly provider?: 'jamendo' | 'audius' | 'openverse' | 'web';
      /** The track's page at the provider, for credits. */
      readonly page?: string;
    }
  | { readonly kind: 'spotify'; readonly uri: string }
  | { readonly kind: 'youtube'; readonly videoId: string };

export const trackSourceSchema: z.ZodType<TrackSource> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('file'), path: z.string().min(1), mime: z.string().optional() }),
  z.object({
    kind: z.literal('url'),
    url: z.url(),
    provider: z.enum(['jamendo', 'audius', 'openverse', 'web']).optional(),
    page: z.url().optional(),
  }),
  z.object({ kind: z.literal('spotify'), uri: z.string().regex(/^spotify:track:[A-Za-z0-9]+$/) }),
  z.object({ kind: z.literal('youtube'), videoId: z.string().regex(/^[\w-]{11}$/) }),
]);

/** Licence facts the publish check needs (PLAN §5). `code` is e.g. `cc-by-4.0`, `own`, `unknown`. */
export interface TrackLicense {
  readonly code: string;
  readonly url?: string;
  readonly attribution?: string;
}
export const trackLicenseSchema = z.object({
  code: z.string().min(1),
  url: z.url().optional(),
  attribution: z.string().optional(),
});

export const PITCH_CLASSES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

/** What analysis found in a track. Times are seconds from the start of the audio. */
export interface TrackAnalysis {
  readonly v: 1;
  /** Which tracker produced the beats, e.g. `dsp-1`. */
  readonly tracker: string;
  readonly duration: number;
  readonly bpm: number;
  /** Constant: one tempo fits every beat. Variable: follow `beats`. */
  readonly tempo: 'constant' | 'variable';
  readonly beats: readonly number[];
  /** Indices into `beats` where a bar starts. */
  readonly downbeats: readonly number[];
  readonly beatsPerBar: number;
  /** Pitch class 0–11 (C = 0). */
  readonly key?: { readonly tonic: number; readonly mode: 'major' | 'minor' };
  /** Section starts in seconds (the first is 0). */
  readonly sections: readonly number[];
}
export const trackAnalysisSchema = z.object({
  v: z.literal(1),
  tracker: z.string(),
  duration: z.number().positive(),
  bpm: z.number().positive(),
  tempo: z.enum(['constant', 'variable']),
  beats: z.array(z.number().min(0)),
  downbeats: z.array(z.number().int().min(0)),
  beatsPerBar: z.number().int().min(1).max(16),
  key: z
    .object({ tonic: z.number().int().min(0).max(11), mode: z.enum(['major', 'minor']) })
    .optional(),
  sections: z.array(z.number().min(0)),
});

/** A tap-calibrated beat grid for sources without raw audio (Spotify, YouTube). */
export interface TrackCalibration {
  readonly bpm: number;
  /** Playback position of a downbeat, in seconds. */
  readonly offset: number;
  readonly beatsPerBar: number;
}
export const trackCalibrationSchema = z.object({
  bpm: z.number().min(20).max(400),
  offset: z.number(),
  beatsPerBar: z.number().int().min(1).max(16),
});

export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artist?: string;
  readonly source: TrackSource;
  readonly license?: TrackLicense;
  readonly analysis?: TrackAnalysis;
  readonly calibration?: TrackCalibration;
  /** Loop between these times (seconds) when the track loops. */
  readonly loop?: { readonly start: number; readonly end?: number };
}
export const trackSchema = z.object({
  id,
  title: z.string(),
  artist: z.string().optional(),
  source: trackSourceSchema,
  license: trackLicenseSchema.optional(),
  analysis: trackAnalysisSchema.optional(),
  calibration: trackCalibrationSchema.optional(),
  loop: z.object({ start: z.number().min(0), end: z.number().positive().optional() }).optional(),
});

export const SFXR_WAVES = ['square', 'saw', 'sine', 'noise'] as const;

/**
 * An sfxr sound. Every number is 0..1 except where noted: ramps and offsets run -1..1. A whole
 * novel's effects fit in a few kilobytes of these.
 */
export interface SfxrParams {
  readonly wave: (typeof SFXR_WAVES)[number];
  readonly attack: number;
  readonly sustain: number;
  readonly punch: number;
  readonly decay: number;
  readonly freq: number;
  readonly freqLimit: number;
  readonly freqRamp: number;
  readonly freqDeltaRamp: number;
  readonly vibratoDepth: number;
  readonly vibratoSpeed: number;
  readonly arpMod: number;
  readonly arpSpeed: number;
  readonly duty: number;
  readonly dutyRamp: number;
  readonly repeatSpeed: number;
  readonly phaserOffset: number;
  readonly phaserRamp: number;
  readonly lpf: number;
  readonly lpfRamp: number;
  readonly lpfResonance: number;
  readonly hpf: number;
  readonly hpfRamp: number;
  readonly volume: number;
}
const unit = z.number().min(0).max(1);
const signed = z.number().min(-1).max(1);
export const sfxrParamsSchema = z.object({
  wave: z.enum(SFXR_WAVES),
  attack: unit,
  sustain: unit,
  punch: unit,
  decay: unit,
  freq: unit,
  freqLimit: unit,
  freqRamp: signed,
  freqDeltaRamp: signed,
  vibratoDepth: unit,
  vibratoSpeed: unit,
  arpMod: signed,
  arpSpeed: unit,
  duty: unit,
  dutyRamp: signed,
  repeatSpeed: unit,
  phaserOffset: signed,
  phaserRamp: signed,
  lpf: unit,
  lpfRamp: signed,
  lpfResonance: unit,
  hpf: unit,
  hpfRamp: signed,
  volume: unit,
});

export interface SoundDef {
  readonly id: string;
  readonly name: string;
  readonly sfxr: SfxrParams;
}
export const soundSchema = z.object({ id, name: z.string(), sfxr: sfxrParamsSchema });

export const VOICE_WAVES = ['square', 'triangle', 'sine', 'sawtooth'] as const;

/** Dialogue blips: a short tone per few typed letters, pitched around `pitch`. */
export interface Voice {
  readonly wave: (typeof VOICE_WAVES)[number];
  /** Base pitch in Hz. */
  readonly pitch: number;
  /** Random pitch spread in semitones. */
  readonly variance: number;
  /** One blip every this many letters. */
  readonly every: number;
  readonly volume: number;
}
export const voiceSchema = z.object({
  wave: z.enum(VOICE_WAVES),
  pitch: z.number().min(40).max(2000),
  variance: z.number().min(0).max(12),
  every: z.number().int().min(1).max(8),
  volume: unit,
});

export interface AudioLibrary {
  readonly tracks: readonly Track[];
  readonly sounds: readonly SoundDef[];
}
export const audioLibrarySchema = z.object({
  tracks: z.array(trackSchema),
  sounds: z.array(soundSchema),
});

export const AMBIENCES = ['rain', 'wind', 'room', 'crowd', 'fire'] as const;
export type Ambience = (typeof AMBIENCES)[number];

/*
 * Params of the audio actions. Actions ending in `.set` describe a state, not an event: the runtime
 * remembers the last one per action and `slot` (see `sceneKey`), so a load or a rewind restores
 * the soundscape.
 */
export const musicSetSchema = z.object({
  track: id.nullable(),
  /** Seconds to fade between the old and new track. */
  fade: z.number().min(0).max(30).optional(),
  volume: unit.optional(),
  loop: z.boolean().optional(),
});
export type MusicSet = z.infer<typeof musicSetSchema>;

export const ambienceSetSchema = z.object({
  /** Which ambience layer; each layer keeps its own volume, so rain and wind can mix. */
  slot: z.enum(AMBIENCES),
  /** 0 turns it off. */
  volume: unit,
  fade: z.number().min(0).max(30).optional(),
});
export type AmbienceSet = z.infer<typeof ambienceSetSchema>;

export const sfxPlaySchema = z.object({ sound: id, volume: unit.optional() });
export type SfxPlay = z.infer<typeof sfxPlaySchema>;

export const AUDIO_ACTIONS = {
  'audio.music.set': musicSetSchema,
  'audio.ambience.set': ambienceSetSchema,
  'audio.sfx.play': sfxPlaySchema,
} as const;
export type AudioActionId = keyof typeof AUDIO_ACTIONS;

export function isAudioAction(action: string): action is AudioActionId {
  return action in AUDIO_ACTIONS;
}
