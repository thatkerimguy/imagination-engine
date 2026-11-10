import type { Locale } from '@ie/i18n';
import { pickLabel, type Beat, type MinigameResult, type StoryRuntime } from '@ie/story';
import { MinigameView } from './minigame-view.ts';

export interface MinigameRunnerSettings {
  readonly locale: Locale;
  /** Longer clocks and wider zones, for readers who asked for help. */
  readonly relaxed: boolean;
  readonly haptics: boolean;
}

export interface MinigameRunnerOptions {
  /** Where the minigame screen goes. */
  readonly host: () => HTMLElement | null;
  /** True when the game covers `host` instead of the whole viewport (the Studio's Play view). */
  readonly contained?: boolean;
  readonly settings: () => MinigameRunnerSettings;
  /** The reader closed the result: resolve the minigame on the runtime and show what follows. */
  readonly resolve: (result: MinigameResult) => void;
}

type MinigameBeat = Extract<Beat, { kind: 'minigame' }>;

/** Same story point, same deal: a rewound game has the lock, word order and dice it had before. */
export function minigameSeed(blockId: string, step: number): number {
  let h = 2166136261 ^ step;
  for (let i = 0; i < blockId.length; i++) h = Math.imul(h ^ blockId.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Mounts a minigame when the story waits on one and takes it down when the story moves elsewhere
 * (a rewind, a load, a restart), as FightRunner does for fights. One game at a time; a redraw of
 * the same beat keeps it running.
 */
export class MinigameRunner {
  private active: { key: string; view: MinigameView } | null = null;

  constructor(private readonly options: MinigameRunnerOptions) {}

  get running(): boolean {
    return this.active !== null;
  }

  start(runtime: StoryRuntime, beat: MinigameBeat): void {
    const key = `${runtime.log.length}:${beat.blockId}`;
    if (this.active?.key === key) return;
    this.stop();
    const block = runtime.story.blocks.get(beat.blockId)?.block;
    const host = this.options.host();
    if (block?.type !== 'minigame' || !host) {
      // Nothing to play on: the story still moves on rather than stalling.
      this.options.resolve({ won: true, score: 0 });
      return;
    }
    const s = this.options.settings();
    const title = pickLabel(block.title, s.locale);
    const view = new MinigameView({
      host,
      ...(this.options.contained ? { contained: true } : {}),
      game: block.game,
      ...(title ? { title } : {}),
      seed: minigameSeed(block.id, runtime.log.length),
      locale: s.locale,
      relaxed: s.relaxed,
      haptics: s.haptics,
      onDone: (result) => {
        if (this.active?.view === view) this.active = null;
        this.options.resolve(result);
      },
    });
    this.active = { key, view };
  }

  /** Stops the game if the story no longer waits on it. */
  sync(runtime: StoryRuntime): void {
    const beat = runtime.waiting;
    const key = beat?.kind === 'minigame' ? `${runtime.log.length}:${beat.blockId}` : null;
    if (this.active && this.active.key !== key) this.stop();
  }

  stop(): void {
    this.active?.view.dispose();
    this.active = null;
  }
}
