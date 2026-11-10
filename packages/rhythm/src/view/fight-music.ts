import { ProceduralBeat, TempoMap, type AudioDirector, type ClockSource } from '@ie/audio';
import type { AudioLibrary, Track } from '@ie/story';

/** The song a fight plays to, with its beat grid. */
export interface FightMusic {
  readonly source: ClockSource;
  readonly tempo: TempoMap;
  /** Section starts in seconds (from analysis), for mixed fights. */
  readonly sections: readonly number[];
  /** Adds layers to procedural music as the fight heats up; songs ignore it. */
  setIntensity(value: number): void;
  /** Stops what the fight started. */
  release(): void;
}

function gridOf(track: Track | undefined): TempoMap | null {
  try {
    if (track?.analysis) return TempoMap.fromAnalysis(track.analysis);
    if (track?.calibration) return TempoMap.fromCalibration(track.calibration);
  } catch {
    // Too few beats for a grid: treat the track as having none.
  }
  return null;
}

const quiet = { setIntensity: () => undefined, release: () => undefined };

/**
 * Picks the fight's music (ADR 0016): the block's track, else the song already playing, else a
 * procedural drum loop. A song without a beat grid can't be fought to, so it falls back too.
 */
export async function prepareFightMusic(
  audio: AudioDirector,
  library: AudioLibrary | undefined,
  trackId: string | undefined,
): Promise<FightMusic> {
  const tracks = library?.tracks ?? [];
  if (trackId) {
    const track = tracks.find((t) => t.id === trackId);
    const tempo = gridOf(track);
    if (track && tempo) {
      await audio.musicSet({ track: track.id, fade: 0.5 });
      if (audio.music.trackId === track.id)
        return {
          source: audio.music.clock,
          tempo,
          sections: track.analysis?.sections ?? [],
          ...quiet,
        };
    }
  }
  const playing = tracks.find((t) => t.id === audio.music.trackId);
  const playingGrid = gridOf(playing);
  if (playing && playingGrid && audio.music.clock.playing)
    return {
      source: audio.music.clock,
      tempo: playingGrid,
      sections: playing.analysis?.sections ?? [],
      ...quiet,
    };
  audio.music.stop(0.4);
  const beat = new ProceduralBeat(audio.engine, 100);
  beat.start();
  return {
    source: beat,
    tempo: beat.tempo,
    sections: [],
    setIntensity: (v) => beat.setIntensity(v),
    release: () => {
      beat.stop(0.4);
      setTimeout(() => beat.dispose(), 500);
    },
  };
}
