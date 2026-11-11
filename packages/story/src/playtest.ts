import type { CompiledStory } from './compile.ts';
import { nextRandom } from './dice.ts';
import { StoryRuntime } from './runtime.ts';
import type { Beat } from './state.ts';

/*
 * The auto-playtester (PLAN §8.3): a bot plays many seeded random runs and reports what it found.
 * Pure and synchronous per run, so the Studio can run it in slices without freezing the page.
 */

export interface PlaytestOptions {
  /** Steps (reader decisions) before a run counts as stuck. */
  readonly maxSteps?: number;
  /** Chance that a fight or minigame is won. */
  readonly winRate?: number;
}

/** Where a run went wrong, by passage and block, so the Studio can jump there. */
export interface PlaytestSpot {
  readonly passage: string | null;
  readonly blockId: string | null;
  readonly count: number;
}

export interface PlaytestReport {
  readonly runs: number;
  /** Ending id (or `''` for an End block without one) → runs that reached it. */
  readonly endings: Readonly<Record<string, number>>;
  /** The story ran out of blocks without an End block. */
  readonly deadEnds: readonly PlaytestSpot[];
  /** A choice with no option the reader could pick. */
  readonly softlocks: readonly PlaytestSpot[];
  /** Runs that hit `maxSteps` without ending (a loop the reader can't leave). */
  readonly stuck: readonly PlaytestSpot[];
  /** Runtime errors, by message. */
  readonly errors: readonly (PlaytestSpot & { readonly message: string })[];
  readonly unseenPassages: readonly string[];
  readonly unchosenOptions: readonly string[];
  /** Number variables: the smallest and largest value seen. */
  readonly ranges: Readonly<Record<string, { readonly min: number; readonly max: number }>>;
  /** Average decisions per finished run. */
  readonly averageSteps: number;
}

/** Running totals, so a report can be built up a slice of runs at a time. */
export class PlaytestTally {
  runs = 0;
  private steps = 0;
  private finished = 0;
  private readonly endings = new Map<string, number>();
  private readonly spots = {
    deadEnds: new Map<string, PlaytestSpot>(),
    softlocks: new Map<string, PlaytestSpot>(),
    stuck: new Map<string, PlaytestSpot>(),
  };
  private readonly errors = new Map<string, PlaytestSpot & { message: string }>();
  private readonly seen = new Set<string>();
  private readonly chosen = new Set<string>();
  private readonly ranges = new Map<string, { min: number; max: number }>();

  constructor(
    readonly story: CompiledStory,
    private readonly options: PlaytestOptions = {},
  ) {}

  /** Plays one run with this seed and adds what happened. */
  play(seed: number): void {
    const maxSteps = this.options.maxSteps ?? 400;
    const winRate = this.options.winRate ?? 0.6;
    this.runs += 1;
    let rng = seed >>> 0 || 1;
    const roll = () => {
      const r = nextRandom(rng);
      rng = r.state;
      return r.value;
    };
    let passage: string | null = null;
    let blockId: string | null = null;
    try {
      const runtime = new StoryRuntime(this.story, { seed });
      for (let step = 0; step < maxSteps; step++) {
        const beats = runtime.advance();
        for (const beat of beats) this.note(beat, (p) => (passage = p));
        this.sample(runtime);
        const beat = runtime.waiting ?? beats.at(-1) ?? null;
        blockId = beat && 'blockId' in beat ? beat.blockId : null;
        if (!beat || beat.kind === 'end' || runtime.ended) {
          this.finish(beat, passage, blockId, step);
          return;
        }
        if (!this.decide(runtime, beat, roll, winRate, passage)) return;
      }
      this.bump(this.spots.stuck, passage, blockId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const key = `${message}|${passage}`;
      const had = this.errors.get(key);
      this.errors.set(key, { message, passage, blockId, count: (had?.count ?? 0) + 1 });
    }
  }

  report(): PlaytestReport {
    const list = (m: Map<string, PlaytestSpot>) =>
      [...m.values()].sort((a, b) => b.count - a.count);
    return {
      runs: this.runs,
      endings: Object.fromEntries(this.endings),
      deadEnds: list(this.spots.deadEnds),
      softlocks: list(this.spots.softlocks),
      stuck: list(this.spots.stuck),
      errors: [...this.errors.values()].sort((a, b) => b.count - a.count),
      unseenPassages: [...this.story.passages.keys()].filter((id) => !this.seen.has(id)),
      unchosenOptions: [...this.story.options.keys()].filter((id) => !this.chosen.has(id)),
      ranges: Object.fromEntries(this.ranges),
      averageSteps: this.finished ? Math.round((this.steps / this.finished) * 10) / 10 : 0,
    };
  }

  private note(beat: Beat, enter: (passage: string) => void): void {
    if (beat.kind === 'passage') {
      this.seen.add(beat.passageId);
      enter(beat.passageId);
    } else if (beat.kind === 'chosen') this.chosen.add(beat.optionId);
  }

  private sample(runtime: StoryRuntime): void {
    for (const def of this.story.variables.values()) {
      if (def.type !== 'number') continue;
      const v = runtime.value(def.id);
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      const r = this.ranges.get(def.id);
      if (!r) this.ranges.set(def.id, { min: v, max: v });
      else {
        r.min = Math.min(r.min, v);
        r.max = Math.max(r.max, v);
      }
    }
  }

  private finish(beat: Beat | null, passage: string | null, blockId: string | null, step: number) {
    this.finished += 1;
    this.steps += step;
    // An end beat without a block means the story simply ran out of things to show.
    if (beat?.kind === 'end' && beat.blockId !== null) {
      const id = beat.endingId ?? '';
      this.endings.set(id, (this.endings.get(id) ?? 0) + 1);
    } else this.bump(this.spots.deadEnds, passage, blockId);
  }

  private bump(map: Map<string, PlaytestSpot>, passage: string | null, blockId: string | null) {
    const key = `${passage}|${blockId}`;
    map.set(key, { passage, blockId, count: (map.get(key)?.count ?? 0) + 1 });
  }

  /** Makes one reader decision. Returns false when the run can't go on (a softlock). */
  private decide(
    runtime: StoryRuntime,
    beat: Beat,
    roll: () => number,
    winRate: number,
    passage: string | null,
  ): boolean {
    const pick = <T>(items: readonly T[]): T | undefined =>
      items[Math.floor(roll() * items.length)];
    switch (beat.kind) {
      case 'choice': {
        const open = beat.options.filter((o) => o.enabled);
        const option = pick(open);
        if (!option) {
          this.bump(this.spots.softlocks, passage, beat.blockId);
          return false;
        }
        runtime.choose(option.id);
        return true;
      }
      case 'input':
        runtime.submit(roll() < 0.5 ? '' : 'Ada');
        return true;
      case 'fight': {
        const won = roll() < winRate;
        runtime.resolveFight({ won, score: Math.round(roll() * 100) });
        return true;
      }
      case 'minigame': {
        const won = roll() < winRate;
        runtime.resolveMinigame({ won, score: Math.round(roll() * 100) });
        return true;
      }
      default:
        break;
    }
    const shop = runtime.shopMenu();
    if (shop) {
      const offer = pick(shop.stock.filter((s) => s.affordable));
      if (offer && roll() < 0.6) runtime.buy(offer.item);
      else runtime.leaveShop();
      return true;
    }
    const battle = runtime.battleMenu();
    if (battle) {
      const r = roll();
      const skill = battle.skills.find((s) => s.enabled);
      const item = battle.items[0];
      if (battle.flee && r < 0.05) runtime.battleAction({ act: 'flee' });
      else if (skill && r < 0.4) runtime.battleAction({ act: 'skill', id: skill.id });
      else if (item && r < 0.5) runtime.battleAction({ act: 'item', id: item.id });
      else runtime.battleAction({ act: 'attack' });
    }
    // Lines, pauses, checks and sequences just need the next tap.
    return true;
  }
}

/** Plays `runs` seeded runs (seeds 1..runs) and reports. */
export function playtest(
  story: CompiledStory,
  runs: number,
  options: PlaytestOptions = {},
): PlaytestReport {
  const tally = new PlaytestTally(story, options);
  for (let seed = 1; seed <= runs; seed++) tally.play(seed);
  return tally.report();
}
