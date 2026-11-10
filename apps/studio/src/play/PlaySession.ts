import type { Locale } from '@ie/i18n';
import { StoryPresenter } from '@ie/present';
import { StoryRuntime, type CompiledStory, type StoryState } from '@ie/story';

/**
 * A throwaway playthrough for the Studio's Play view: the same runtime and presenter the Player
 * uses, without saves. Back steps through an in-memory list of states.
 */
export class PlaySession {
  readonly presenter: StoryPresenter;
  private runtime: StoryRuntime;
  private readonly history: StoryState[] = [];

  constructor(
    private readonly story: CompiledStory,
    private readonly start: string | undefined,
    locale: Locale,
    /** Called after every step with whether Back can go further. */
    private readonly onChange: (canBack: boolean) => void,
  ) {
    this.runtime = this.create();
    this.presenter = new StoryPresenter(
      this.runtime,
      {
        choose: (id) => this.act(() => this.runtime.choose(id)),
        submit: (answer) => this.act(() => this.runtime.submit(answer)),
        restart: () => this.restart(),
        advance: () => this.advance(),
      },
      { locale, speed: 'normal', timers: true },
    );
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
    this.presenter.redraw();
    this.onChange(this.canBack);
  }

  restart(): void {
    this.history.length = 0;
    this.runtime = this.create();
    this.presenter.attach(this.runtime);
    this.begin();
    this.onChange(this.canBack);
  }

  setLocale(locale: Locale): void {
    this.presenter.setOptions({ locale, speed: 'normal', timers: true });
  }

  dispose(): void {
    this.presenter.dispose();
  }

  private create(): StoryRuntime {
    return new StoryRuntime(this.story, this.start ? { start: this.start } : {});
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
