import {
  AMBIENCES,
  ambienceSetSchema,
  musicSetSchema,
  sceneKey,
  type Ambience,
  type AmbienceSet,
  type AudioLibrary,
  type CharacterDef,
  type MusicSet,
  type SfxPlay,
  type SfxrParams,
  type Voice,
} from '@ie/story';
import { AMBIENCE_RATE, renderAmbience } from './ambience.ts';
import type { AudioEngine } from './engine.ts';
import { MusicPlayer, type TrackResolver } from './music.ts';
import { renderSfxr, SFXR_RATE } from './sfxr.ts';
import { TempoMap } from './tempo.ts';

export interface AudioDirectorOptions {
  readonly engine: AudioEngine;
  readonly resolve: TrackResolver;
  readonly library: () => AudioLibrary | undefined;
  readonly characters: () => readonly CharacterDef[];
}

/** Counts letters and says when a voice should blip: every `every`-th letter. */
export class BlipCounter {
  private letters = 0;

  feed(text: string, every: number): number {
    let blips = 0;
    for (const ch of text) {
      if (!/\p{L}|\p{N}/u.test(ch)) continue;
      if (this.letters % every === 0) blips++;
      this.letters++;
    }
    return blips;
  }

  reset(): void {
    this.letters = 0;
  }
}

const MIN_BLIP_GAP = 0.045;

/**
 * Plays a novel's sound: the audio actions, the scene after a load or a rewind, dialogue voices,
 * and previews for the Studio. It holds no story logic; the runtime decides what plays.
 */
export class AudioDirector {
  readonly music: MusicPlayer;
  private readonly ambience = new Map<
    Ambience,
    { gain: GainNode; source: AudioBufferSourceNode }
  >();
  private readonly ambienceBuffers = new Map<Ambience, AudioBuffer>();
  private readonly sounds = new Map<string, { params: SfxrParams; buffer: AudioBuffer }>();
  private readonly counter = new BlipCounter();
  private lastBlip = 0;
  private speaker: string | null = null;

  constructor(private readonly options: AudioDirectorOptions) {
    this.music = new MusicPlayer(options.engine, options.resolve);
  }

  get engine(): AudioEngine {
    return this.options.engine;
  }

  /** A library track's playable URL, for players that read the audio themselves (beatmaps). */
  async trackUrl(trackId: string): Promise<string | null> {
    const track = this.options.library()?.tracks.find((t) => t.id === trackId);
    return track ? this.options.resolve(track) : null;
  }

  musicSet(params: MusicSet): Promise<void> {
    const track = this.options.library()?.tracks.find((t) => t.id === params.track);
    return this.music.set(params, track);
  }

  ambienceSet({ slot, volume, fade = 2 }: AmbienceSet): void {
    const engine = this.options.engine;
    const ctx = engine.context;
    let layer = this.ambience.get(slot);
    if (!layer && volume > 0) {
      const source = ctx.createBufferSource();
      source.buffer = this.ambienceBuffer(slot);
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(engine.input('ambience'));
      source.start();
      layer = { gain, source };
      this.ambience.set(slot, layer);
    }
    if (!layer) return;
    const now = ctx.currentTime;
    layer.gain.gain.cancelScheduledValues(now);
    layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
    layer.gain.gain.linearRampToValueAtTime(volume, now + Math.max(0.05, fade));
    if (volume === 0) {
      const ending = layer;
      ending.source.stop(now + Math.max(0.05, fade) + 0.05);
      this.ambience.delete(slot);
    }
  }

  sfxPlay({ sound, volume = 1 }: SfxPlay): void {
    const def = this.options.library()?.sounds.find((s) => s.id === sound);
    if (!def) return;
    let cached = this.sounds.get(def.id);
    if (!cached || cached.params !== def.sfxr) {
      cached = { params: def.sfxr, buffer: this.engine.buffer(renderSfxr(def.sfxr), SFXR_RATE) };
      this.sounds.set(def.id, cached);
    }
    this.engine.play(cached.buffer, 'sfx', volume);
  }

  /** Plays sfxr params directly (the Studio's sound designer). */
  preview(params: SfxrParams): void {
    this.engine.play(this.engine.buffer(renderSfxr(params), SFXR_RATE), 'sfx');
  }

  /**
   * Brings the soundscape in line with a runtime's scene: after a load, a rewind or a restart,
   * play exactly what the last `.set` actions describe.
   */
  private tempo: { readonly id: string; readonly map: TempoMap | null } | null = null;

  /**
   * Where the playing song is within its beat, 0..1 (0 = on a beat), from its analysis or tap
   * calibration; null with no music or no grid. The stage pulses titles with it.
   */
  beatPhase(): number | null {
    const info = this.beatInfo();
    return info ? info.beat - Math.floor(info.beat) : null;
  }

  /**
   * The playing song's beat count and bar length, from its analysis or calibration; null with no
   * music or no grid. Materials read Beat and Bar phase from it (ADR 0020).
   */
  beatInfo(): { beat: number; beatsPerBar: number } | null {
    const id = this.music.trackId;
    if (!id || !this.music.clock.playing) return null;
    if (this.tempo?.id !== id) {
      const track = this.options.library()?.tracks.find((t) => t.id === id);
      let map: TempoMap | null = null;
      try {
        if (track?.analysis) map = TempoMap.fromAnalysis(track.analysis);
        else if (track?.calibration) map = TempoMap.fromCalibration(track.calibration);
      } catch {
        map = null; // too few beats for a grid
      }
      this.tempo = { id, map };
    }
    if (!this.tempo.map) return null;
    return {
      beat: this.tempo.map.beatAt(this.music.clock.position()),
      beatsPerBar: this.tempo.map.beatsPerBar,
    };
  }

  applyScene(scene: Readonly<Record<string, unknown>>): void {
    const music = musicSetSchema.safeParse(scene['audio.music.set']);
    void this.musicSet(music.success ? { ...music.data, fade: 1 } : { track: null, fade: 1 });
    for (const slot of AMBIENCES) {
      const set = ambienceSetSchema.safeParse(scene[sceneKey('audio.ambience.set', { slot })]);
      const volume = set.success ? set.data.volume : 0;
      if (volume > 0 || this.ambience.has(slot)) this.ambienceSet({ slot, volume, fade: 1 });
    }
  }

  /** Text was just typed in; blip in the speaker's voice. `speaker` is null for narration. */
  typed(speaker: string | null, text: string): void {
    if (speaker !== this.speaker) {
      this.speaker = speaker;
      this.counter.reset();
    }
    if (!speaker || !this.engine.started) return;
    const voice = this.options.characters().find((c) => c.id === speaker)?.voice;
    if (!voice) return;
    if (this.counter.feed(text, voice.every) > 0) this.blip(voice);
  }

  /** One blip in a voice (also the Studio's voice preview). */
  blip(voice: Voice): void {
    const ctx = this.engine.context;
    const now = ctx.currentTime;
    if (now - this.lastBlip < MIN_BLIP_GAP) return;
    this.lastBlip = now;
    const osc = ctx.createOscillator();
    osc.type = voice.wave;
    osc.frequency.value = voice.pitch * 2 ** (((Math.random() * 2 - 1) * voice.variance) / 12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(voice.volume * 0.4, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc.connect(gain).connect(this.engine.input('voice'));
    osc.start(now);
    osc.stop(now + 0.07);
    osc.onended = () => gain.disconnect();
  }

  /** Stops everything (leaving Play, closing a novel). */
  stopAll(): void {
    this.music.stop(0.3);
    for (const slot of [...this.ambience.keys()]) this.ambienceSet({ slot, volume: 0, fade: 0.3 });
  }

  dispose(): void {
    this.stopAll();
    this.music.dispose();
  }

  private ambienceBuffer(kind: Ambience): AudioBuffer {
    let buffer = this.ambienceBuffers.get(kind);
    if (!buffer) {
      buffer = this.engine.buffer(renderAmbience(kind), AMBIENCE_RATE);
      this.ambienceBuffers.set(kind, buffer);
    }
    return buffer;
  }
}
