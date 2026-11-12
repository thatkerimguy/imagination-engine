import type { AudioDirector } from '@ie/audio';
import { createTranslator, type Locale } from '@ie/i18n';
import type { Beat, RhythmResult, StoryRuntime } from '@ie/story';
import type { Mod } from '../rules.ts';
import { el } from './beatmap-hud.ts';
import type { RhythmPrefs } from './beatmap-menus.ts';
import { BeatmapView } from './beatmap-view.ts';
import { beatmapMessages } from './messages.ts';
import { loadSong } from './song-clock.ts';

export interface BeatmapRunnerSettings {
  readonly locale: Locale;
  readonly haptics: boolean;
  /** Changes the app's help setting always turns on. */
  readonly forceMods: readonly Mod[];
}

export interface BeatmapRunnerOptions {
  readonly audio: AudioDirector;
  readonly host: () => HTMLElement | null;
  readonly contained?: boolean;
  readonly settings: () => BeatmapRunnerSettings;
  readonly prefs: { load(): RhythmPrefs; save(prefs: RhythmPrefs): void };
  /** The reader closed the results: resolve the block on the runtime and show what follows. */
  readonly resolve: (result: RhythmResult) => void;
}

type RhythmBeat = Extract<Beat, { kind: 'rhythm' }>;

interface Active {
  readonly key: string;
  view: BeatmapView | null;
  loading: HTMLElement | null;
  /** The story's music before the beatmap, played again after it. */
  readonly music: string | null;
}

/**
 * Mounts a beatmap when the story waits on one and takes it down when the story moves elsewhere
 * (a rewind, a load, a restart). One at a time; a redraw of the same beat keeps it running.
 */
export class BeatmapRunner {
  private active: Active | null = null;

  constructor(private readonly options: BeatmapRunnerOptions) {}

  get running(): boolean {
    return this.active !== null;
  }

  start(runtime: StoryRuntime, beat: RhythmBeat): void {
    const key = `${runtime.log.length}:${beat.blockId}`;
    if (this.active?.key === key) return;
    this.stop();
    const token: Active = { key, view: null, loading: null, music: this.options.audio.music.trackId };
    this.active = token;
    void this.mount(runtime, beat, token);
  }

  /** Stops the beatmap if the story no longer waits on it. */
  sync(runtime: StoryRuntime): void {
    const beat = runtime.waiting;
    const key = beat?.kind === 'rhythm' ? `${runtime.log.length}:${beat.blockId}` : null;
    if (this.active && this.active.key !== key) this.stop();
  }

  stop(): void {
    const active = this.active;
    if (!active) return;
    active.view?.dispose();
    active.loading?.remove();
    this.active = null;
  }

  private async mount(runtime: StoryRuntime, beat: RhythmBeat, token: Active): Promise<void> {
    const { audio } = this.options;
    const block = runtime.story.blocks.get(beat.blockId)?.block;
    const project = runtime.story.project;
    const map =
      block?.type === 'rhythm' ? project.beatmaps?.find((b) => b.id === block.beatmap) : undefined;
    const host = this.options.host();
    if (block?.type !== 'rhythm' || !map || !host) {
      // The analyzer flags a missing beatmap; the story still moves on rather than stalling.
      this.active = null;
      this.options.resolve({ won: true, score: 0 });
      return;
    }
    const s = this.options.settings();
    const text = createTranslator(beatmapMessages, s.locale);
    token.loading = el('div', this.options.contained ? 'ie-bm ie-bm--contained ie-bm--loading' : 'ie-bm ie-bm--loading', host, text('bm.loading'));
    token.loading.setAttribute('role', 'status');
    audio.music.stop(0.4);
    const url = map.track ? await audio.trackUrl(map.track) : null;
    const song = await loadSong(audio.engine, url);
    token.loading?.remove();
    token.loading = null;
    if (this.active !== token) return;
    token.view = new BeatmapView({
      host,
      ...(this.options.contained ? { contained: true } : {}),
      beatmap: map,
      song,
      engine: audio.engine,
      locale: s.locale,
      prefs: this.options.prefs.load(),
      savePrefs: (p) => this.options.prefs.save(p),
      ...(block.pass !== undefined ? { pass: block.pass } : {}),
      haptics: s.haptics,
      forceMods: s.forceMods,
      onDone: (result) => {
        if (this.active === token) this.active = null;
        if (token.music) void audio.musicSet({ track: token.music, fade: 1 });
        this.options.resolve(result ?? { won: false, score: 0 });
      },
    });
  }
}
