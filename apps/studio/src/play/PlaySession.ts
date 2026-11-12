import type { AudioDirector } from '@ie/audio';
import type { Locale } from '@ie/i18n';
import { ScreenHost, SpaceDeck, StoryPresenter } from '@ie/present';
import { MinigameRunner } from '@ie/minigame';
import { BeatmapRunner, FightRunner, parsePrefs } from '@ie/rhythm';
import { readPref, writePref } from '@ie/ui-kit';
import { SequenceRunner } from '@ie/sequencer';
import type { StageDirector } from '@ie/stage';
import { StoryRuntime, type CompiledStory, type StoryState } from '@ie/story';

/** Beatmap settings on this device, shared with the editor's test play. */
export const RHYTHM_PREFS = 'ie.studio.rhythm';

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
  /** The story's title screen, HUDs and panels; the view places its elements. */
  readonly screens: ScreenHost;
  /** The spaces beside the story (ADR 0031), when the novel has any; the view places it. */
  readonly spaces: SpaceDeck | null;
  private runtime: StoryRuntime;
  private readonly history: StoryState[] = [];
  private readonly fights: FightRunner | null;
  private readonly minigames: MinigameRunner | null;
  private readonly rhythms: BeatmapRunner | null;
  private readonly sequences: SequenceRunner | null;
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
    this.sequences =
      fights && audio
        ? new SequenceRunner({
            audio: fights.audio,
            dispatch: (id, params) => audio.run(id, params),
            done: () => this.advance(),
          })
        : null;
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
          ...(audio ? { dispatch: (id: string, params: unknown) => audio.run(id, params) } : {}),
          resolve: (result) => this.act(() => this.runtime.resolveFight(result)),
        })
      : null;
    this.rhythms = fights
      ? new BeatmapRunner({
          audio: fights.audio,
          host: fights.host,
          contained: true,
          settings: () => ({ locale: this.locale, haptics: false, forceMods: [] }),
          prefs: {
            load: () => parsePrefs(readPref(RHYTHM_PREFS)),
            save: (p) => writePref(RHYTHM_PREFS, JSON.stringify(p)),
          },
          resolve: (result) => this.act(() => this.runtime.resolveRhythm(result)),
        })
      : null;
    this.minigames = fights
      ? new MinigameRunner({
          host: fights.host,
          contained: true,
          settings: () => ({ locale: this.locale, relaxed: false, haptics: false }),
          resolve: (result) => this.act(() => this.runtime.resolveMinigame(result)),
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
        minigame: (beat) => this.minigames?.start(this.runtime, beat),
        rhythm: (beat) => this.rhythms?.start(this.runtime, beat),
        sequence: (beat) => this.sequences?.start(this.runtime, beat),
        buy: (item) => this.act(() => this.runtime.buy(item)),
        sell: (item) => this.act(() => this.runtime.sell(item)),
        leaveShop: () => this.act(() => this.runtime.leaveShop()),
        battle: (action) => this.act(() => this.runtime.battleAction(action)),
        go: (roomId) => this.act(() => this.runtime.go(roomId)),
        ...(audio
          ? { typed: (speaker: string | null, text: string) => audio.typed(speaker, text) }
          : {}),
      },
      { locale, speed: 'normal', timers: true },
    );
    // Play keeps no saves, so a title screen's Continue is hidden and both buttons start.
    this.screens = new ScreenHost(
      this.runtime,
      {
        start: () => this.play(),
        continue: () => this.play(),
        changed: () => this.presenter.redraw(),
        toggled: () => this.presenter.hold(this.screens.covering),
      },
      { locale, canContinue: () => false },
    );
    const sides = story.project.spaces ?? [];
    if (sides.length) {
      const pane = document.createElement('div');
      pane.className = 'play__story';
      pane.append(this.presenter.element);
      this.spaces = new SpaceDeck(
        pane,
        sides,
        {
          go: (roomId) => this.act(() => this.runtime.go(roomId)),
          screen: (element, screenId) => this.screens.showIn(element, screenId),
          canMove: () => !this.fighting && !this.screens.covering,
          moved: (atStory) => this.presenter.hold(!atStory || this.screens.covering),
        },
        locale,
      );
      this.spaces.refresh(this.runtime);
    } else this.spaces = null;
  }

  /** What the view puts on the page: the spaces around the story, or the story alone. */
  get element(): HTMLElement {
    return this.spaces?.element ?? this.presenter.element;
  }

  /** True while a fight or a minigame has the screen (its keys are its own). */
  get fighting(): boolean {
    return (
      (this.fights?.running ?? false) ||
      (this.minigames?.running ?? false) ||
      (this.rhythms?.running ?? false)
    );
  }

  get canBack(): boolean {
    return this.history.length > 0;
  }

  /** Starts the playthrough: on the title screen when the story has one and plays from the start. */
  begin(): void {
    if (!this.start && this.screens.showTitle()) return;
    this.play();
  }

  private play(): void {
    this.presenter.show(this.runtime.advance());
    this.refreshAround();
  }

  /** HUDs, open screens and spaces follow every step. */
  private refreshAround(): void {
    this.screens.refresh();
    this.spaces?.refresh(this.runtime);
  }

  /** A tap: finish the line being typed, or move on when a line, check, pause or sequence waits. */
  tap(): void {
    if (this.screens.covering) return;
    if (this.presenter.busy) return this.presenter.skip();
    this.advance();
  }

  advance(): void {
    const kind = this.runtime.waiting?.kind;
    if (kind === 'line' || kind === 'check' || kind === 'pause' || kind === 'sequence')
      this.act(() => undefined);
  }

  back(): void {
    const state = this.history.pop();
    if (!state) return;
    this.runtime.restore(state);
    this.fights?.sync(this.runtime);
    this.minigames?.sync(this.runtime);
    this.rhythms?.sync(this.runtime);
    this.sequences?.sync(this.runtime);
    this.presenter.redraw();
    this.refreshAround();
    this.audio?.applyScene(this.runtime.scene);
    this.onChange(this.canBack);
  }

  restart(): void {
    this.history.length = 0;
    this.fights?.stop();
    this.minigames?.stop();
    this.rhythms?.stop();
    this.sequences?.stop();
    this.runtime = this.create();
    this.presenter.attach(this.runtime);
    this.screens.close();
    this.screens.attach(this.runtime);
    this.spaces?.home();
    this.spaces?.refresh(this.runtime);
    this.audio?.applyScene({});
    this.begin();
    this.onChange(this.canBack);
  }

  setLocale(locale: Locale): void {
    this.locale = locale;
    this.presenter.setOptions({ locale, speed: 'normal', timers: true });
    this.screens.setLocale(locale);
    this.spaces?.setLocale(locale);
  }

  dispose(): void {
    this.fights?.stop();
    this.minigames?.stop();
    this.rhythms?.stop();
    this.sequences?.stop();
    this.presenter.dispose();
    this.screens.dispose();
    this.audio?.stopAll();
  }

  private create(): StoryRuntime {
    const audio = this.audio;
    return new StoryRuntime(this.story, {
      ...(this.start ? { start: this.start } : {}),
      ...(audio
        ? { host: { runAction: (id: string, params: unknown) => this.runAction(id, params) } }
        : {}),
    });
  }

  /** Story actions go to the action bus; a sequence that doesn't wait plays here. */
  private runAction(id: string, params: unknown): void {
    if (id === 'sequence.play' && this.sequences) {
      const sequence = (params as { sequence?: unknown }).sequence;
      if (typeof sequence === 'string') this.sequences.play(this.story.project, sequence);
      return;
    }
    this.audio?.run(id, params);
  }

  private act(change: () => void): void {
    const before = this.runtime.snapshot();
    change();
    this.history.push(before);
    if (this.history.length > 200) this.history.shift();
    this.presenter.show(this.runtime.advance());
    this.refreshAround();
    this.onChange(this.canBack);
  }
}
