import { HitSounds, loadSong, SongClock, type SongSource } from '@ie/rhythm';
import { objectEnd, type BeatmapDef } from '@ie/story';
import { useEffect, useState } from 'react';
import { director, engine } from '../audio/studio-audio.ts';
import { songPeaks, type EditorTime } from './editor-time.ts';

/*
 * The note editor's sound: the beatmap's song decoded once (exact timing and a waveform), and a
 * playhead that follows the song clock with a hit sound on every note it passes.
 */

export interface LoadedSong {
  readonly source: SongSource;
  /** One peak per PEAK_MS for the timeline; null when the song could only stream. */
  readonly peaks: Float32Array | null;
  /** Length in ms, 0 when unknown. */
  readonly duration: number;
}

const NO_SONG: LoadedSong = { source: { kind: 'none' }, peaks: null, duration: 0 };

// A decoded song is large, so only the last one is kept, for switching tabs and maps.
let cached: { readonly id: string; readonly song: Promise<LoadedSong> } | null = null;

async function decode(trackId: string): Promise<LoadedSong> {
  const url = await director.trackUrl(trackId).catch(() => null);
  const source = await loadSong(engine, url);
  if (source.kind !== 'buffer') return { source, peaks: null, duration: 0 };
  return { source, peaks: songPeaks(source.buffer), duration: source.buffer.duration * 1000 };
}

function songFor(trackId: string): Promise<LoadedSong> {
  if (cached?.id !== trackId) cached = { id: trackId, song: decode(trackId) };
  return cached.song;
}

/** The beatmap's song, or null while it loads. */
export function useSong(trackId: string | undefined): LoadedSong | null {
  const [loaded, setLoaded] = useState<{ readonly id: string; readonly song: LoadedSong } | null>(
    null,
  );
  useEffect(() => {
    if (!trackId) return;
    let live = true;
    void songFor(trackId).then((song) => {
      if (live) setLoaded({ id: trackId, song });
    });
    return () => {
      live = false;
    };
  }, [trackId]);
  if (!trackId) return NO_SONG;
  return loaded?.id === trackId ? loaded.song : null;
}

/** Moments a hit sound plays: heads, slider turns and ends, spinner ends. */
function soundTimes(map: BeatmapDef): number[] {
  const out: number[] = [];
  for (const o of map.objects) {
    if (o.kind === 'circle') out.push(o.t);
    else if (o.kind === 'spinner') out.push(o.end);
    else {
      const span = (o.end - o.t) / Math.max(1, o.slides);
      for (let k = 0; k <= o.slides; k++) out.push(o.t + k * span);
    }
  }
  return out.sort((a, b) => a - b);
}

export class EditorPlayback {
  private clock: SongClock | null = null;
  private frame = 0;
  private readonly sounds = new HitSounds(engine);
  private readonly listeners = new Set<(playing: boolean) => void>();

  constructor(private readonly time: EditorTime) {}

  get playing(): boolean {
    return this.clock !== null;
  }

  onChange(listener: (playing: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  play(song: LoadedSong, map: BeatmapDef, from: number, hitSounds: boolean): void {
    this.halt();
    void engine.resume();
    if (director.music.trackId) director.music.stop(0.2);
    const clock = new SongClock(engine, song.source, 1, map.timing, this.sounds, { offset: 0 });
    clock.start(from);
    this.clock = clock;
    const times = soundTimes(map);
    let next = times.findIndex((t) => t >= from);
    if (next < 0) next = times.length;
    const last = map.objects.reduce((m, o) => Math.max(m, objectEnd(o)), 0);
    const stopAt = Math.max(song.duration, last + 1500);
    const tick = () => {
      if (this.clock !== clock) return;
      const t = clock.now();
      // A sound started now is heard after the output latency, like the song itself.
      const heard = t + engine.outputLatency * 1000;
      let played = false;
      while (next < times.length && (times[next] as number) <= heard) {
        if (hitSounds && !played) this.sounds.play('hit');
        played = true;
        next++;
      }
      this.time.set(t);
      if (t > stopAt) return this.stop();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
    this.emit();
  }

  stop(): void {
    if (!this.clock) return;
    this.halt();
    this.emit();
  }

  dispose(): void {
    this.halt();
    this.listeners.clear();
  }

  private halt(): void {
    cancelAnimationFrame(this.frame);
    this.clock?.dispose();
    this.clock = null;
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.playing);
  }
}
