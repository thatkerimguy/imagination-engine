import { TempoMap, trackTempo, type AudioDirector, type ClockSource } from '@ie/audio';
import { beatsPerBarOf, SEQUENCE_LIMITS, type AudioLibrary, type SequenceDef } from '@ie/story';

/** What a sequence plays against: a source to read time from and its beat grid. */
export interface SequenceClock {
  readonly source: ClockSource;
  readonly tempo: TempoMap;
  /** True for a song: beat 0 waits for its next downbeat. A silent clock starts at once. */
  readonly song: boolean;
}

/** A steady clock on the wall clock, for sequences with no song (exact, so nothing smooths it). */
export function wallClock(now: () => number = () => performance.now()): ClockSource {
  const start = now();
  return {
    position: () => (now() - start) / 1000,
    playing: true,
    exact: true,
  };
}

/** The tempo a sequence uses without a song: its own BPM and bar. */
export function steadyTempo(sequence: SequenceDef): TempoMap {
  return TempoMap.constant(sequence.bpm ?? SEQUENCE_LIMITS.bpm.default, 0, beatsPerBarOf(sequence));
}

/**
 * Picks a sequence's clock (ADR 0019): its own song when that has a beat grid, else the song
 * already playing when it has one, else a steady tempo with no sound.
 */
export async function prepareSequenceClock(
  audio: AudioDirector,
  library: AudioLibrary | undefined,
  sequence: SequenceDef,
): Promise<SequenceClock> {
  const tracks = library?.tracks ?? [];
  if (sequence.track) {
    const track = tracks.find((t) => t.id === sequence.track);
    const tempo = trackTempo(track);
    if (track && tempo) {
      await audio.musicSet({ track: track.id, fade: 0.5 });
      if (audio.music.trackId === track.id) return { source: audio.music.clock, tempo, song: true };
    }
  }
  const playing = tracks.find((t) => t.id === audio.music.trackId);
  const playingTempo = trackTempo(playing);
  if (playing && playingTempo && audio.music.clock.playing)
    return { source: audio.music.clock, tempo: playingTempo, song: true };
  return { source: wallClock(), tempo: steadyTempo(sequence), song: false };
}

/** The beat a sequence starts on: the next downbeat of a song, or now on a silent clock. */
export function startBeat(now: number, beatsPerBar: number, song: boolean): number {
  if (!song) return Math.max(0, now);
  // A little lead, so a downbeat that is about to pass isn't taken as the start.
  return Math.ceil((now + 0.05) / beatsPerBar) * beatsPerBar + 0; // + 0 turns -0 into 0
}
