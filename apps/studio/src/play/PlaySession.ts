import type { AudioDirector } from '@ie/audio';
import type { Locale } from '@ie/i18n';
import { StoryPresenter } from '@ie/present';
import { FightRunner } from '@ie/rhythm';
import type { StageDirector } from '@ie/stage';
import { StoryRuntime, type CompiledStory, type StoryState } from '@ie/story';

/** What a playthrough needs from the Studio's sound (see audio/studio-audio.ts). */
export interface PlayAudio {
  run(actionId: string, params: unknown): void;
  typed(speaker: string | null, text: string): void;
  applyScene(scene: Readonly<Record<string, unknown>>): void;
  stopAll(): void;
}

/** What fights need in Play: the sound, the stage, and the panel the fight screen covers. */
export interface PlayFights {
  readonly audio: AudioDirector;
  readonly stage: StageDirector;
  readonly host: () => HTMLElement | null;
  readonly tapLatency: () => number;
}

/**
 * A throwaway playthrough for the Studio's Play view: the same runtime and presenter the Player
 * uses, without saves. Back steps through an in-memory list of states.
 */
export class PlaySession {
  readonly presenter: StoryPresenter;
  private runtime: StoryRuntime;
  private readonly history: StoryState[] = [];
  private readonly fights: FightRunner | null;
  private locale: Locale;

  constructor(
    private readonly story: CompiledStory,
    private readonly start: string | undefined,
    locale: Locale,
    /** Called after every step with whether Back can go further. */
    private readonly onChange: (canBack: boolean) => void,
    private readonly audio?: PlayAudio,
    fights?: PlayFights,
  ) {
    this.locale = locale;
    this.runtime = this.create();
    this.fights = fights
      ? new FightRunner({
          audio: fights.audio,
          stage: fights.stage,
          host: fights.host,
          contained: true,
          settings: () => ({
            locale: this.locale,
            assist: {},
            haptics: false,
            tapLatency: fights.tapLatency(),
          }),
          resolve: (result) => this.act(() => this.runtime.resolveFight(result)),
        })
      : null;
    this.presenter = new StoryPresenter(
      this.runtime,
      {
        choose: (id) => this.act(() => this.runtime.choose(id)),
        submit: (answer) => this.act(() => this.runtime.submit(answer)),
        restart: () => this.restart(),
        advance: () => this.advance(),
        fight: (beat) => this.fights?.start(this.runtime, beat),
        ...(audio
          ? { typed: (speaker: string | null, text: string) => audio.typed(speaker, text) }
          : {}),
      },
      { locale, speed: 'normal', timers: true },
    );
  }

  /** True while a fight has the screen (its keys are its own). */
  get fighting(): boolean {
    return this.fights?.running ?? false;
  }

  get canBack(): boolean {
    return this.history.length > 0;
  }

  begin(): void {
    this.presenter.show(this.runtime.advance());
  }

  /** A tap: finish the line being typed, or move on when a line, check or pause waits. */
  tap(): void {
    if (this.presenter.busy) return this.presenter.skip();
    this.advance();
  }

  advance(): void {
    const kind = this.runtime.waiting?.kind;
    if (kind === 'line' || kind === 'check' || kind === 'pause') this.act(() => undefined);
  }

  back(): void {
    const state = this.history.pop();
    if (!state) return;
    this.runtime.restore(state);
    this.fights?.sync(this.runtime);
    this.presenter.redraw();
    this.audio?.applyScene(this.runtime.scene);
    this.onChange(this.canBack);
  }

  restart(): void {
    this.history.length = 0;
    this.fights?.stop();
    this.runtime = this.create();
    this.presenter.attach(this.runtime);
    this.audio?.applyScene({});
    this.begin();
    this.onChange(this.canBack);
  }

  setLocale(locale: Locale): void {
    this.locale = locale;
    this.presenter.setOptions({ locale, speed: 'normal', timers: true });
  }

  dispose(): void {
    this.fights?.stop();
    this.presenter.dispose();
    this.audio?.stopAll();
  }

  private create(): StoryRuntime {
    const audio = this.audio;
    return new StoryRuntime(this.story, {
      ...(this.start ? { start: this.start } : {}),
      ...(audio
        ? { host: { runAction: (id: string, params: unknown) => audio.run(id, params) } }
        : {}),
    });
  }

  private act(change: () => void): void {
    const before = this.runtime.snapshot();
    change();
    this.history.push(before);
    if (this.history.length > 200) this.history.shift();
    this.presenter.show(this.runtime.advance());
    this.onChange(this.canBack);
  }
}
