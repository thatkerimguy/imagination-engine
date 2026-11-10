import type { Value } from '@ie/core';
import type { Locale } from '@ie/i18n';
import { battleAction, battleMenu, type BattleAction, type BattleMenu } from './battle.ts';
import { optionView } from './choices.ts';
import { listKey, type CompiledStory } from './compile.ts';
import { truthy, valueText } from './formula.ts';
import type { FightResult } from './fight.ts';
import { minigameValues, type MinigameResult } from './minigame.ts';
import type { Formula, LocalText } from './schema.ts';
import type { ScreenAction } from './screens.ts';
import { reconcileState } from './reconcile.ts';
import { buy, leaveShop, sell, shopMenu, type ShopMenu } from './rpg-run.ts';
import { runBlock } from './run-block.ts';
import { RuntimeCore } from './runtime-core.ts';
import { type RuntimeOptions } from './runtime-options.ts';
import { fireRules } from './rules.ts';
import { emptyState, pageStart, type Beat, type Mutable, type StoryState } from './state.ts';
import { renderMarkup, type Piece, type TextContext } from './text.ts';

export { ENDINGS_KEY, type RuntimeOptions, type StoryHost } from './runtime-options.ts';
export type { BattleAction, BattleMenu } from './battle.ts';
export type { ShopMenu } from './rpg-run.ts';

const LOG_LIMIT = 400;
const STEP_LIMIT = 10_000;

/**
 * The story interpreter. Pure and DOM-free: the Player, the Studio's Play view and an
 * auto-playtester all drive it the same way: `advance()` until a beat needs the reader, then
 * `choose()`, `submit()`, a shop or a battle action. The working parts live in RuntimeCore.
 */
export class StoryRuntime {
  private readonly core: RuntimeCore;
  /** Log index up to which beats have been handed to the presenter. */
  private delivered = 0;

  constructor(
    readonly story: CompiledStory,
    options: RuntimeOptions = {},
  ) {
    this.core = new RuntimeCore(story, options.host ?? {}, options.persistent);
    if (options.state) this.reconcile(structuredClone(options.state));
    else this.fresh(options.seed, options.start);
    // A restored state is redrawn from page(); only a fresh story still has beats to hand out.
    this.delivered = options.state ? this.core.s.log.length : 0;
  }

  /** A copy of the state, for saves and the rewind history. */
  snapshot(): StoryState {
    return structuredClone(this.core.s);
  }

  restore(state: StoryState): void {
    this.reconcile(structuredClone(state));
    this.delivered = this.core.s.log.length;
  }

  get ended(): boolean {
    return this.core.s.ended;
  }

  /** What `.set` actions say should be playing now (see `StoryState.scene`). */
  get scene(): Readonly<Record<string, unknown>> {
    return this.core.s.scene ?? {};
  }

  get log(): readonly Beat[] {
    return this.core.s.log;
  }

  /** The beats on the current page, oldest first. */
  page(): readonly Beat[] {
    return this.core.s.log.slice(pageStart(this.core.s.log));
  }

  /** The beat waiting for the reader (a line, choice, input, pause, check, fight, shop, battle or the end). */
  get waiting(): Beat | null {
    return this.core.waiting;
  }

  get persistentValues(): Readonly<Record<string, Value>> {
    return this.core.persistent;
  }

  /** Item counts the reader carries. */
  get inventory(): Readonly<Record<string, number>> {
    return this.core.s.inv ?? {};
  }

  get quests(): NonNullable<StoryState['quests']> {
    return this.core.s.quests ?? {};
  }

  value(id: string): Value {
    return this.core.value(id);
  }

  /** Renders a line in a language, with the values a beat captured (or the current ones). */
  render(text: LocalText, locale: Locale, values?: Readonly<Record<string, Value>>): Piece[] {
    return renderMarkup(this.story.markup(text, locale), this.textContext(locale, values));
  }

  textContext(locale: Locale, values?: Readonly<Record<string, Value>>): TextContext {
    return {
      locale,
      value: (id) => (values && id in values ? (values[id] ?? null) : this.value(id)),
      character: (id) => {
        const def = this.story.characters.get(id);
        if (!def) return undefined;
        const name = def.name[locale] ?? def.name.en ?? def.name.tr ?? id;
        return def.suffixAs ? { name, suffixAs: def.suffixAs } : { name };
      },
    };
  }

  /**
   * Runs until something needs the reader. Returns every beat not yet handed out, in order: the
   * option just chosen or answer just given, passage changes, then the beat that now waits.
   * While a shop or battle waits, it only hands out what the last purchase or turn left.
   */
  advance(): Beat[] {
    const s = this.core.s;
    if (s.ended) return this.takeBeats();
    const current = this.waiting;
    if (current?.kind === 'shop' || current?.kind === 'battle') return this.takeBeats();
    const kind = current?.kind;
    if (kind === 'choice' || kind === 'input' || kind === 'fight' || kind === 'minigame') {
      throw new Error('The story is waiting for a choice, an answer, a fight or a minigame.');
    }
    s.waiting = null;
    for (let steps = 0; ; steps++) {
      if (steps > STEP_LIMIT) {
        throw new Error(
          'The story ran 10,000 steps without showing anything. A Jump or a rule probably loops back on itself.',
        );
      }
      if (this.step()) break;
    }
    this.trimLog();
    return this.takeBeats();
  }

  private takeBeats(): Beat[] {
    const beats = this.core.s.log.slice(this.delivered);
    this.delivered = this.core.s.log.length;
    return beats;
  }

  /**
   * A screen button's Set action (ADR 0018): the set block's operation, applied between steps.
   * Rules it triggers run at the next step.
   */
  screenSet(action: Extract<ScreenAction, { type: 'set' }>): void {
    const value = action.value === undefined ? null : this.core.compute(action.value);
    this.core.applySet(action.var, action.op ?? 'set', value);
  }

  /** Whether a formula holds right now: a screen component's visibility. */
  holds(formula: Formula): boolean {
    return truthy(this.core.compute(formula));
  }

  choose(optionId: string): void {
    const core = this.core;
    const beat = this.waiting;
    if (beat?.kind !== 'choice') throw new Error('There is no choice waiting.');
    const view = beat.options.find((o) => o.id === optionId);
    const found = this.story.options.get(optionId);
    if (!view || !found || found.choice.id !== beat.blockId)
      throw new Error(`"${optionId}" isn't one of the choices shown.`);
    const fresh = optionView(found.choice, optionId, core.optionContext);
    if (!fresh?.enabled) throw new Error(`"${optionId}" can't be chosen right now.`);
    if (found.option.cost)
      core.write(
        found.option.cost.var,
        core.num(found.option.cost.var) - (fresh.cost?.amount ?? 0),
      );
    core.s.chosen = { ...core.s.chosen, [optionId]: (core.s.chosen[optionId] ?? 0) + 1 };
    core.resetScope('temp');
    core.record({
      kind: 'chosen',
      blockId: beat.blockId,
      optionId,
      values: core.snapshotValues(found.option.text),
    });
    core.s.waiting = null;
    core.push({ list: listKey.option(optionId), index: 0 });
  }

  submit(answer: string): void {
    const core = this.core;
    const beat = this.waiting;
    if (beat?.kind !== 'input') throw new Error('There is no question waiting.');
    const info = this.story.blocks.get(beat.blockId);
    if (info?.block.type !== 'input') throw new Error('The question is no longer in the story.');
    const limit = info.block.maxLength ?? 40;
    // An empty answer keeps the current value (the default name), so the text never has a hole.
    const value = answer.trim().slice(0, limit) || valueText(this.value(info.block.var));
    core.write(info.block.var, value);
    core.resetScope('temp');
    core.record({ kind: 'answered', blockId: beat.blockId, value });
    core.s.waiting = null;
  }

  /** Ends the waiting fight: stores the score, then plays its win or lose blocks. */
  resolveFight(result: FightResult): void {
    const core = this.core;
    const beat = this.waiting;
    if (beat?.kind !== 'fight') throw new Error('There is no fight waiting.');
    const info = this.story.blocks.get(beat.blockId);
    if (info?.block.type !== 'fight') throw new Error('The fight is no longer in the story.');
    const score = Math.round(Math.max(0, Math.min(100, result.score)));
    if (info.block.score) core.write(info.block.score, score);
    core.record({ kind: 'fought', blockId: beat.blockId, won: result.won, score });
    core.s.waiting = null;
    core.push({
      list: result.won ? listKey.win(beat.blockId) : listKey.lose(beat.blockId),
      index: 0,
    });
  }

  /** Ends the waiting minigame: stores its score and values, then plays its win or lose blocks. */
  resolveMinigame(result: MinigameResult): void {
    const core = this.core;
    const beat = this.waiting;
    if (beat?.kind !== 'minigame') throw new Error('There is no minigame waiting.');
    const block = this.story.blocks.get(beat.blockId)?.block;
    if (block?.type !== 'minigame') throw new Error('The minigame is no longer in the story.');
    const score = Math.round(Math.max(0, Math.min(100, result.score)));
    if (block.score) core.write(block.score, score);
    const names = minigameValues(block.game);
    for (const [name, variable] of Object.entries(block.store ?? {})) {
      const value = result.values?.[name];
      if (names.includes(name) && typeof value === 'number' && Number.isFinite(value))
        core.write(variable, value);
    }
    core.record({ kind: 'played', blockId: beat.blockId, won: result.won, score });
    core.s.waiting = null;
    core.push({
      list: result.won ? listKey.win(beat.blockId) : listKey.lose(beat.blockId),
      index: 0,
    });
  }

  /** What the open shop sells and buys, or null when no shop waits. */
  shopMenu(): ShopMenu | null {
    return shopMenu(this.core);
  }

  buy(itemId: string): void {
    buy(this.core, itemId);
  }

  sell(itemId: string): void {
    sell(this.core, itemId);
  }

  leaveShop(): void {
    leaveShop(this.core);
  }

  /** The battle in progress: HP, skills and items on offer, or null when none waits. */
  battleMenu(): BattleMenu | null {
    return battleMenu(this.core);
  }

  battleAction(action: BattleAction): void {
    battleAction(this.core, action);
  }

  // --- execution -------------------------------------------------------------------------

  /** Runs one block (after any rules now due). Returns true when a beat waits for the reader. */
  private step(): boolean {
    const core = this.core;
    fireRules(core);
    const frames = core.s.frames;
    const top = frames.at(-1);
    if (!top) return core.finish(null);
    const list = this.story.lists.get(top.list) ?? [];
    if (top.call) {
      core.s.frames = frames.slice(0, -1); // a called passage ran out: return to the caller
      return false;
    }
    const block = list[top.index];
    if (!block) {
      core.s.frames = frames.slice(0, -1);
      if (core.s.frames.length === 0 && !core.s.events?.length) return core.finish(null);
      return false;
    }
    core.s.frames = [...frames.slice(0, -1), { ...top, index: top.index + 1, at: block.id }];
    return runBlock(core, block);
  }

  private trimLog(): void {
    const s = this.core.s;
    const excess = s.log.length - LOG_LIMIT;
    if (excess <= 0) return;
    const drop = Math.min(excess, pageStart(s.log)); // never drop the page on screen
    if (drop <= 0) return;
    s.log = s.log.slice(drop);
    if (s.waiting !== null) s.waiting -= drop;
    this.delivered = Math.max(0, this.delivered - drop);
  }

  private fresh(seed?: number, start?: string): void {
    this.core.s = emptyState(seed);
    this.core.enter(start ?? this.story.project.start);
  }

  /** Fits a saved state to the story as it is now (ADR 0007). */
  private reconcile(state: Mutable<StoryState>): void {
    const restartAt = reconcileState(this.story, state);
    this.core.s = state;
    if (restartAt === null) return;
    state.frames = [];
    state.waiting = null;
    delete state.battle;
    this.core.enter(restartAt);
  }
}
