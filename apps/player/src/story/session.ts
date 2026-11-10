import type { KeyValueStore, Value } from '@ie/core';
import {
  StoryRuntime,
  type BattleAction,
  type Beat,
  type CompiledStory,
  type FightResult,
  type StoryState,
} from '@ie/story';
import { RewindHistory } from './history.ts';
import {
  readPersistent,
  readSave,
  writePersistent,
  writeSave,
  type SaveFile,
  type SlotId,
} from './saves.ts';

export interface SessionHost {
  /** Runs a module action from an Action block. */
  runAction(id: string, params: unknown): void;
}

/**
 * One reader's playthrough of one story: the runtime, the rewind history, autosave after every
 * action, manual slots and persistent values. No DOM; the presenter draws what it returns.
 */
export class StorySession {
  private persistent: Record<string, Value>;
  private writes: Promise<void> = Promise.resolve();
  private runtimeRef: StoryRuntime;
  // Assigned by open(), the only way to make a session.
  private history!: RewindHistory;

  private constructor(
    readonly story: CompiledStory,
    private readonly store: KeyValueStore,
    private readonly host: SessionHost,
    persistent: Record<string, Value>,
    state: StoryState | undefined,
  ) {
    this.persistent = persistent;
    this.runtimeRef = this.createRuntime(state);
  }

  /** Opens the story where the reader left it (the autosave, with its way back), or at the start. */
  static async open(
    story: CompiledStory,
    store: KeyValueStore,
    host: SessionHost,
  ): Promise<StorySession> {
    const id = story.project.id;
    const [persistent, auto] = await Promise.all([
      readPersistent(store, id),
      readSave(store, id, 'auto'),
    ]);
    const session = new StorySession(story, store, host, persistent, auto?.state);
    session.history = await RewindHistory.load(store, id, auto?.state, (write) =>
      session.queue(write),
    );
    return session;
  }

  get runtime(): StoryRuntime {
    return this.runtimeRef;
  }

  /** True once the reader has read anything of this playthrough (a title screen's Continue). */
  get hasProgress(): boolean {
    // A new playthrough has entered its first passage but not yet run to anything to read.
    return this.runtime.waiting !== null || this.runtime.ended;
  }

  /** Saves a change made between steps, such as a screen button that sets a variable. */
  commit(): void {
    this.autosave();
  }

  get canGoBack(): boolean {
    return this.history.length > 0;
  }

  /** True when a tap should move the story on (a line, a check or a pause is waiting). */
  get canAdvance(): boolean {
    const kind = this.runtime.waiting?.kind;
    return kind === 'line' || kind === 'check' || kind === 'pause';
  }

  /**
   * Runs a new or edited story up to its first beat that needs the reader. Returns the beats to
   * type in; empty when a restored page should simply be redrawn.
   */
  start(): Beat[] {
    if (this.runtime.waiting || this.runtime.ended) return [];
    const beats = this.runtime.advance();
    this.autosave();
    return beats;
  }

  advance(): Beat[] {
    if (!this.canAdvance) return [];
    return this.act(() => undefined);
  }

  choose(optionId: string): Beat[] {
    return this.act(() => this.runtime.choose(optionId));
  }

  submit(answer: string): Beat[] {
    return this.act(() => this.runtime.submit(answer));
  }

  /** Ends the waiting fight with its result; the story branches on it. */
  fight(result: FightResult): Beat[] {
    return this.act(() => this.runtime.resolveFight(result));
  }

  /** One purchase, sale or battle turn is one reader action, so one step back undoes it. */
  buy(itemId: string): Beat[] {
    return this.act(() => this.runtime.buy(itemId));
  }

  sell(itemId: string): Beat[] {
    return this.act(() => this.runtime.sell(itemId));
  }

  leaveShop(): Beat[] {
    return this.act(() => this.runtime.leaveShop());
  }

  battle(action: BattleAction): Beat[] {
    return this.act(() => this.runtime.battleAction(action));
  }

  /** Steps back one reader action. */
  back(): boolean {
    return this.rewindTo(this.history.length - 1);
  }

  /** Returns to an earlier point in the history; everything after it is forgotten. */
  rewindTo(index: number): boolean {
    const state = this.history.at(index);
    if (!state) return false;
    this.history.truncate(index);
    this.runtime.restore(state);
    this.autosave();
    return true;
  }

  /**
   * The history entry that waited at the choice answered by the `chosen` beat at `logIndex`,
   * so the backlog can offer "go back to this choice".
   */
  choicePoint(logIndex: number): number | null {
    const chosen = this.runtime.log[logIndex];
    if (chosen?.kind !== 'chosen') return null;
    const states = this.history.states();
    for (let i = states.length - 1; i >= 0; i--) {
      const state = states[i];
      const waiting = state && state.waiting !== null ? state.log[state.waiting] : undefined;
      if (
        state?.log.length === logIndex &&
        waiting?.kind === 'choice' &&
        waiting.blockId === chosen.blockId
      )
        return i;
    }
    return null;
  }

  /** Starts a new playthrough. Persistent values and endings stay. */
  restart(): Beat[] {
    this.history.clear();
    this.runtimeRef = this.createRuntime(undefined);
    return this.start();
  }

  async save(slot: Exclude<SlotId, 'auto'>): Promise<void> {
    await this.flush();
    await writeSave(this.store, this.story.project.id, slot, this.runtime.snapshot());
  }

  /** Loads a slot. Returns the beats to type in (if the save needed settling) or null when empty. */
  async load(slot: SlotId): Promise<Beat[] | null> {
    const save = await readSave(this.store, this.story.project.id, slot);
    if (!save) return null;
    this.history.clear();
    this.runtimeRef = this.createRuntime(save.state);
    const beats = this.start();
    if (beats.length === 0) this.autosave(); // start() already saved when it moved on
    return beats;
  }

  async slot(slot: SlotId): Promise<SaveFile | undefined> {
    return readSave(this.store, this.story.project.id, slot);
  }

  /** Resolves once every pending write has reached storage. */
  flush(): Promise<void> {
    return this.writes;
  }

  private act(change: () => void): Beat[] {
    const before = this.runtime.snapshot();
    change(); // throws on an invalid choice, leaving history untouched
    const beats = this.runtime.advance();
    this.history.push(before);
    this.autosave();
    return beats;
  }

  private createRuntime(state: StoryState | undefined): StoryRuntime {
    return new StoryRuntime(this.story, {
      ...(state ? { state } : {}),
      persistent: this.persistent,
      host: {
        runAction: (id, params) => this.host.runAction(id, params),
        onPersistentChange: (values) => {
          this.persistent = { ...values };
          this.queue(() => writePersistent(this.store, this.story.project.id, this.persistent));
        },
      },
    });
  }

  private autosave(): void {
    const state = this.runtime.snapshot();
    this.queue(() => writeSave(this.store, this.story.project.id, 'auto', state));
  }

  /** Writes run one after another, so an older state never lands after a newer one. */
  private queue(write: () => Promise<void>): void {
    this.writes = this.writes.then(write).catch((error: unknown) => console.warn(error));
  }
}
