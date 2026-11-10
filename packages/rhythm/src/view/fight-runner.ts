import type { AudioDirector } from '@ie/audio';
import type { Locale } from '@ie/i18n';
import type { StageDirector } from '@ie/stage';
import { FIGHT_BARS, pickLabel, type Beat, type FightResult, type StoryRuntime } from '@ie/story';
import type { Assist } from '../fight.ts';
import { prepareFightMusic } from './fight-music.ts';
import { FightView } from './fight-view.ts';

export interface FightRunnerSettings {
  readonly locale: Locale;
  readonly assist: Assist;
  readonly haptics: boolean;
  /** How late this device registers a tap after hearing the sound, in seconds. */
  readonly tapLatency: number;
}

export interface FightRunnerOptions {
  readonly audio: AudioDirector;
  readonly stage: StageDirector | null;
  /** Where the fight screen goes. */
  readonly host: () => HTMLElement | null;
  /** True when the fight covers `host` instead of the whole viewport (the Studio's Play view). */
  readonly contained?: boolean;
  readonly settings: () => FightRunnerSettings;
  /** Runs a choreography cue from a move sequence or chart (ADR 0019). */
  readonly dispatch?: (action: string, params: unknown) => void;
  /** The reader closed the result: resolve the fight on the runtime and show what follows. */
  readonly resolve: (result: FightResult) => void;
}

type FightBeat = Extract<Beat, { kind: 'fight' }>;

/** Same story point, same chart: a rewound fight plays the moves it played before. */
function seedFor(blockId: string, step: number): number {
  let h = 2166136261 ^ step;
  for (let i = 0; i < blockId.length; i++) h = Math.imul(h ^ blockId.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Mounts a fight when the story waits on one and takes it down when the story moves elsewhere
 * (a rewind, a load, a restart). One fight at a time; a redraw of the same beat keeps it running.
 */
export class FightRunner {
  private active: { key: string; view: FightView | null } | null = null;

  constructor(private readonly options: FightRunnerOptions) {}

  get running(): boolean {
    return this.active !== null;
  }

  start(runtime: StoryRuntime, beat: FightBeat): void {
    const key = `${runtime.log.length}:${beat.blockId}`;
    if (this.active?.key === key) return;
    this.stop();
    const token: { key: string; view: FightView | null } = { key, view: null };
    this.active = token;
    void this.mount(runtime, beat, token);
  }

  /** Stops the fight if the story no longer waits on it. */
  sync(runtime: StoryRuntime): void {
    const beat = runtime.waiting;
    const key = beat?.kind === 'fight' ? `${runtime.log.length}:${beat.blockId}` : null;
    if (this.active && this.active.key !== key) this.stop();
  }

  stop(): void {
    this.active?.view?.dispose();
    this.active = null;
  }

  private async mount(
    runtime: StoryRuntime,
    beat: FightBeat,
    token: { key: string; view: FightView | null },
  ): Promise<void> {
    const { audio, stage } = this.options;
    const block = runtime.story.blocks.get(beat.blockId)?.block;
    const project = runtime.story.project;
    const enemy =
      block?.type === 'fight' ? project.enemies?.find((e) => e.id === block.enemy) : undefined;
    const host = this.options.host();
    if (block?.type !== 'fight' || !enemy || !host) {
      // The analyzer flags a missing enemy; the story still moves on rather than stalling.
      this.active = null;
      this.options.resolve({ won: true, score: 0 });
      return;
    }
    const chart = block.chart
      ? project.sequences?.find((s) => s.id === block.chart && s.kind === 'scene')
      : undefined;
    // A chart is written to a song, so it brings that song unless the block names another.
    const music = await prepareFightMusic(audio, project.audio, block.track ?? chart?.track);
    if (this.active !== token) {
      music.release();
      return;
    }
    const s = this.options.settings();
    token.view = new FightView({
      host,
      ...(this.options.contained ? { contained: true } : {}),
      enemy,
      enemyName: pickLabel(enemy.name, s.locale, enemy.id),
      presence: (enemy.presence ?? []).map((p) => pickLabel(p, s.locale)).filter(Boolean),
      mode: block.mode ?? 'call',
      difficulty: block.difficulty ?? 'normal',
      bars: block.bars ?? FIGHT_BARS.default,
      seed: seedFor(block.id, runtime.log.length),
      music,
      outputLatency: audio.engine.outputLatency,
      tapLatency: s.tapLatency,
      stage,
      engine: audio.engine,
      assist: s.assist,
      haptics: s.haptics,
      locale: s.locale,
      ...(project.sequences ? { sequences: project.sequences } : {}),
      ...(chart ? { chart } : {}),
      ...(this.options.dispatch ? { dispatch: this.options.dispatch } : {}),
      onDone: (result) => {
        if (this.active === token) this.active = null;
        this.options.resolve(result);
      },
    });
  }
}
