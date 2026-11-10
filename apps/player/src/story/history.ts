import type { KeyValueStore } from '@ie/core';
import type { StoryState } from '@ie/story';
import { deleteHistoryEntry, readHistory, writeHistoryEntry } from './saves.ts';

/** How far back the reader can step. Each entry is one full state (a few kB). */
const LIMIT = 100;
/** How many of the newest steps are also stored, to survive the tab being closed. */
const STORED = 30;

export type Queue = (write: () => Promise<void>) => void;

interface Entry {
  readonly seq: number;
  readonly state: StoryState;
}

const sameBeat = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * True when `entry` is an earlier point on the way to `state`. Every reader action adds beats, so
 * an ancestor's log is a shorter prefix of the current one. Anything else was left behind by a
 * rewind whose clean-up didn't reach storage before the tab closed.
 */
function leadsTo(entry: StoryState, state: StoryState): boolean {
  const n = entry.log.length;
  if (n >= state.log.length) return false;
  for (let i = Math.max(0, n - 2); i < n; i++)
    if (!sameBeat(entry.log[i], state.log[i])) return false;
  return true;
}

/**
 * The rewind history. Each step is written once, under its own key, when it is taken: writing at
 * page hide isn't reliable, because unloading aborts IndexedDB transactions still in flight.
 */
export class RewindHistory {
  private entries: Entry[] = [];
  private seq = 0;

  private constructor(
    private readonly store: KeyValueStore,
    private readonly storyId: string,
    private readonly queue: Queue,
  ) {}

  /** Loads the stored steps that lead to `current`, and forgets the rest. */
  static async load(
    store: KeyValueStore,
    storyId: string,
    current: StoryState | undefined,
    queue: Queue,
  ): Promise<RewindHistory> {
    const history = new RewindHistory(store, storyId, queue);
    const files = await readHistory(store, storyId);
    history.seq = files.reduce((max, f) => Math.max(max, f.seq), 0);
    const kept = current ? files.filter((f) => leadsTo(f.state, current)) : [];
    kept.sort((a, b) => a.state.log.length - b.state.log.length);
    history.entries = kept.map(({ seq, state }) => ({ seq, state }));
    const keptSeqs = new Set(kept.map((f) => f.seq));
    for (const file of files) if (!keptSeqs.has(file.seq)) history.forget(file.seq);
    return history;
  }

  get length(): number {
    return this.entries.length;
  }

  at(index: number): StoryState | undefined {
    return this.entries[index]?.state;
  }

  states(): StoryState[] {
    return this.entries.map((e) => e.state);
  }

  push(state: StoryState): void {
    const seq = ++this.seq;
    this.entries.push({ seq, state });
    this.queue(() => writeHistoryEntry(this.store, this.storyId, seq, state));
    // Older steps stay in memory but leave storage.
    const leaving = this.entries[this.entries.length - 1 - STORED];
    if (leaving) this.forget(leaving.seq);
    if (this.entries.length > LIMIT) this.entries.shift();
  }

  /** Forgets every step from `index` on (after a rewind to it). */
  truncate(index: number): void {
    for (const entry of this.entries.slice(index)) this.forget(entry.seq);
    this.entries = this.entries.slice(0, index);
  }

  clear(): void {
    this.truncate(0);
  }

  private forget(seq: number): void {
    this.queue(() => deleteHistoryEntry(this.store, this.storyId, seq));
  }
}
