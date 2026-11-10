import type { EngineEvents, EventBus } from '@ie/core';
import type { StoryPresenter } from '@ie/present';
import type { Beat, FightResult } from '@ie/story';
import type { StoryActionsHost } from './module.ts';
import type { SlotId } from './saves.ts';
import type { StorySession } from './session.ts';

/** Joins the session (what happens) to the presenter (what is drawn), and reports story events. */
export class StoryController implements StoryActionsHost {
  constructor(
    readonly session: StorySession,
    readonly presenter: StoryPresenter,
    private readonly events: EventBus<EngineEvents>,
    /** The soundscape the story says should be playing, after a jump in time (load, rewind). */
    private readonly onScene: (scene: Readonly<Record<string, unknown>>) => void = () => {},
  ) {}

  /** Plays what the current point of the story says should be playing. */
  syncScene(): void {
    this.onScene(this.session.runtime.scene);
  }

  /** Opens on the reader's last page, or types the first line of a new story. Returns true if new. */
  begin(): boolean {
    this.presenter.attach(this.session.runtime);
    const beats = this.session.start();
    if (beats.length) this.show(beats);
    else this.presenter.redraw();
    this.syncScene();
    return beats.length > 0;
  }

  advance(): void {
    this.show(this.session.advance());
  }

  choose(optionId: string): void {
    this.show(this.session.choose(optionId));
  }

  submit(answer: string): void {
    this.show(this.session.submit(answer));
  }

  fight(result: FightResult): void {
    this.show(this.session.fight(result));
    this.syncScene();
  }

  back(): void {
    if (!this.session.back()) return;
    this.presenter.redraw();
    this.syncScene();
  }

  rewind(to: number): void {
    if (!this.session.rewindTo(to)) return;
    this.presenter.redraw();
    this.syncScene();
  }

  restart(): void {
    const beats = this.session.restart();
    this.presenter.attach(this.session.runtime);
    this.show(beats);
    this.syncScene();
  }

  save(slot: Exclude<SlotId, 'auto'>): Promise<void> {
    return this.session.save(slot);
  }

  async load(slot: SlotId): Promise<void> {
    const beats = await this.session.load(slot);
    if (beats === null) return;
    this.presenter.attach(this.session.runtime);
    if (beats.length) this.show(beats);
    else this.presenter.redraw();
    this.syncScene();
  }

  private show(beats: readonly Beat[]): void {
    this.presenter.show(beats);
    for (const beat of beats) {
      if (beat.kind === 'passage')
        this.events.emit('story.passageEntered', { passageId: beat.passageId });
      else if (beat.kind === 'chosen')
        this.events.emit('story.choiceMade', { optionId: beat.optionId });
      else if (beat.kind === 'end')
        this.events.emit('story.ended', { endingId: beat.endingId ?? null });
    }
  }
}
