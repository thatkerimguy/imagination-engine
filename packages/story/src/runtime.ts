import type { Value } from '@ie/core';
import type { Locale } from '@ie/i18n';
import { defaultValue, listKey, type CompiledStory } from './compile.ts';
import { optionView, timerFor, type OptionContext } from './choices.ts';
import { nextRandom, parseDice } from './dice.ts';
import { evaluate, truthy, valueText, type EvalContext } from './formula.ts';
import type { FightResult } from './fight.ts';
import type { Block, Formula, LocalText, Scope } from './schema.ts';
import { reconcileState } from './reconcile.ts';
import { ENDINGS_KEY, type RuntimeOptions, type StoryHost } from './runtime-options.ts';
import {
  emptyState,
  pageStart,
  rememberScene,
  type Beat,
  type Frame,
  type Mutable,
  type OptionView,
  type StoryState,
} from './state.ts';
import { applyOperation, coerceValue } from './variables.ts';
import { renderMarkup, type Piece, type TextContext } from './text.ts';

export { ENDINGS_KEY, type RuntimeOptions, type StoryHost } from './runtime-options.ts';

const LOG_LIMIT = 400;
const STEP_LIMIT = 10_000;

/**
 * The story interpreter. Pure and DOM-free: the Player, the Studio's Play view and an
 * auto-playtester all drive it the same way: `advance()` until a beat needs the reader, then
 * `choose()` or `submit()`.
 */
export class StoryRuntime {
  private s: Mutable<StoryState>;
  private persistent: Record<string, Value>;
  private readonly host: StoryHost;
  private readonly evalContext: EvalContext;
  private readonly optionContext: OptionContext;
  /** Log index up to which beats have been handed to the presenter. */
  private delivered = 0;

  constructor(
    readonly story: CompiledStory,
    options: RuntimeOptions = {},
  ) {
    this.host = options.host ?? {};
    this.persistent = { ...options.persistent };
    this.s = options.state
      ? this.reconcile(structuredClone(options.state))
      : this.fresh(options.seed, options.start);
    // A restored state is redrawn from page(); only a fresh story still has beats to hand out.
    this.delivered = options.state ? this.s.log.length : 0;
    this.evalContext = {
      value: (id) => this.value(id),
      visits: (id) => this.s.visits[id] ?? 0,
      chosen: (id) => this.s.chosen[id] ?? 0,
      random: (min, max) => this.randomInt(min, max),
    };
    this.optionContext = {
      compute: (formula) => this.compute(formula),
      num: (id) => this.num(id),
      timesChosen: (id) => this.s.chosen[id] ?? 0,
      formula: (formula) => this.story.formula(formula),
    };
  }

  /** A copy of the state, for saves and the rewind history. */
  snapshot(): StoryState {
    return structuredClone(this.s);
  }

  restore(state: StoryState): void {
    this.s = this.reconcile(structuredClone(state));
    this.delivered = this.s.log.length;
  }

  get ended(): boolean {
    return this.s.ended;
  }

  /** What `.set` actions say should be playing now (see `StoryState.scene`). */
  get scene(): Readonly<Record<string, unknown>> {
    return this.s.scene ?? {};
  }

  get log(): readonly Beat[] {
    return this.s.log;
  }

  /** The beats on the current page, oldest first. */
  page(): readonly Beat[] {
    return this.s.log.slice(pageStart(this.s.log));
  }

  /** The beat waiting for the reader (a line, choice, input, pause, check, fight or the end). */
  get waiting(): Beat | null {
    return this.s.waiting === null ? null : (this.s.log[this.s.waiting] ?? null);
  }

  get persistentValues(): Readonly<Record<string, Value>> {
    return this.persistent;
  }

  value(id: string): Value {
    const def = this.story.variables.get(id);
    if (!def) return null;
    const stored = def.scope === 'persistent' ? this.persistent[id] : this.s.vars[id];
    return stored === undefined ? defaultValue(def) : stored;
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
   */
  advance(): Beat[] {
    if (this.s.ended) return this.takeBeats();
    const current = this.waiting;
    if (current?.kind === 'choice' || current?.kind === 'input' || current?.kind === 'fight') {
      throw new Error('The story is waiting for a choice, an answer or a fight.');
    }
    this.s.waiting = null;
    for (let steps = 0; ; steps++) {
      if (steps > STEP_LIMIT) {
        throw new Error(
          'The story ran 10,000 steps without showing anything. A Jump probably loops back on itself.',
        );
      }
      if (this.step()) break;
    }
    this.trimLog();
    return this.takeBeats();
  }

  private takeBeats(): Beat[] {
    const beats = this.s.log.slice(this.delivered);
    this.delivered = this.s.log.length;
    return beats;
  }

  choose(optionId: string): void {
    const beat = this.waiting;
    if (beat?.kind !== 'choice') throw new Error('There is no choice waiting.');
    const view = beat.options.find((o) => o.id === optionId);
    const found = this.story.options.get(optionId);
    if (!view || !found || found.choice.id !== beat.blockId)
      throw new Error(`"${optionId}" isn't one of the choices shown.`);
    const fresh = optionView(found.choice, optionId, this.optionContext);
    if (!fresh?.enabled) throw new Error(`"${optionId}" can't be chosen right now.`);
    if (found.option.cost)
      this.write(
        found.option.cost.var,
        this.num(found.option.cost.var) - (fresh.cost?.amount ?? 0),
      );
    this.s.chosen = { ...this.s.chosen, [optionId]: (this.s.chosen[optionId] ?? 0) + 1 };
    this.resetScope('temp');
    this.record({
      kind: 'chosen',
      blockId: beat.blockId,
      optionId,
      values: this.snapshotValues(found.option.text),
    });
    this.s.waiting = null;
    this.push({ list: listKey.option(optionId), index: 0 });
  }

  submit(answer: string): void {
    const beat = this.waiting;
    if (beat?.kind !== 'input') throw new Error('There is no question waiting.');
    const info = this.story.blocks.get(beat.blockId);
    if (info?.block.type !== 'input') throw new Error('The question is no longer in the story.');
    const limit = info.block.maxLength ?? 40;
    // An empty answer keeps the current value (the default name), so the text never has a hole.
    const value = answer.trim().slice(0, limit) || valueText(this.value(info.block.var));
    this.write(info.block.var, value);
    this.resetScope('temp');
    this.record({ kind: 'answered', blockId: beat.blockId, value });
    this.s.waiting = null;
  }

  /** Ends the waiting fight: stores the score, then plays its win or lose blocks. */
  resolveFight(result: FightResult): void {
    const beat = this.waiting;
    if (beat?.kind !== 'fight') throw new Error('There is no fight waiting.');
    const info = this.story.blocks.get(beat.blockId);
    if (info?.block.type !== 'fight') throw new Error('The fight is no longer in the story.');
    const score = Math.round(Math.max(0, Math.min(100, result.score)));
    if (info.block.score) this.write(info.block.score, score);
    this.record({ kind: 'fought', blockId: beat.blockId, won: result.won, score });
    this.s.waiting = null;
    this.push({
      list: result.won ? listKey.win(beat.blockId) : listKey.lose(beat.blockId),
      index: 0,
    });
  }

  // --- execution -------------------------------------------------------------------------

  /** Runs one block. Returns true when a beat now waits for the reader. */
  private step(): boolean {
    const frames = this.s.frames;
    const top = frames.at(-1);
    if (!top) return this.finish(null);
    const list = this.story.lists.get(top.list) ?? [];
    if (top.call) {
      this.s.frames = frames.slice(0, -1); // a called passage ran out: return to the caller
      return false;
    }
    const block = list[top.index];
    if (!block) {
      this.s.frames = frames.slice(0, -1);
      if (this.s.frames.length === 0) return this.finish(null);
      return false;
    }
    this.s.frames = [...frames.slice(0, -1), { ...top, index: top.index + 1, at: block.id }];
    return this.run(block);
  }

  private run(block: Block): boolean {
    switch (block.type) {
      case 'narration':
      case 'dialogue':
        return this.wait({
          kind: 'line',
          blockId: block.id,
          values: this.snapshotValues(block.text),
        });
      case 'choice': {
        const views = block.options
          .map((o) => optionView(block, o.id, this.optionContext))
          .filter((v): v is OptionView => v !== null);
        if (views.length === 0) return false;
        const values = this.snapshotValues(block.prompt, ...block.options.map((o) => o.text));
        const timer = block.timer ? timerFor(block, views) : undefined;
        return this.wait(
          timer
            ? { kind: 'choice', blockId: block.id, options: views, timer, values }
            : { kind: 'choice', blockId: block.id, options: views, values },
        );
      }
      case 'if': {
        const branch = block.branches.find((b) => truthy(this.compute(b.when)));
        if (branch) this.push({ list: listKey.branch(branch.id), index: 0 });
        else if (block.else) this.push({ list: listKey.else(block.id), index: 0 });
        return false;
      }
      case 'check': {
        const dice = parseDice(block.dice);
        const rolls = Array.from({ length: dice.count }, () => this.randomInt(1, dice.sides));
        const modifier =
          block.modifier === undefined ? 0 : Number(this.compute(block.modifier)) || 0;
        const target = Number(this.compute(block.target)) || 0;
        const success = rolls.reduce((a, b) => a + b, 0) + modifier >= target;
        this.push({ list: success ? listKey.success(block.id) : listKey.fail(block.id), index: 0 });
        return this.wait({
          kind: 'check',
          blockId: block.id,
          rolls,
          modifier,
          target,
          success,
          values: this.snapshotValues(block.label),
        });
      }
      case 'input':
        return this.wait({ kind: 'input', blockId: block.id });
      case 'pause':
        return this.wait(
          block.seconds === undefined
            ? { kind: 'pause', blockId: block.id }
            : { kind: 'pause', blockId: block.id, seconds: block.seconds },
        );
      case 'set':
        this.applySet(
          block.var,
          block.op ?? 'set',
          block.value === undefined ? null : this.compute(block.value),
        );
        return false;
      case 'jump':
        while (this.s.frames.length && !this.s.frames.at(-1)?.call)
          this.s.frames = this.s.frames.slice(0, -1);
        this.enter(block.to);
        return false;
      case 'call':
        this.push({ list: '', index: 0, call: true });
        this.enter(block.to);
        return false;
      case 'return': {
        const boundary = this.s.frames.findLastIndex((f) => f.call);
        this.s.frames = boundary < 0 ? [] : this.s.frames.slice(0, boundary);
        return false;
      }
      case 'random': {
        const total = block.branches.reduce((sum, b) => sum + (b.weight ?? 1), 0);
        let roll = this.randomFloat() * total;
        const branch =
          block.branches.find((b) => (roll -= b.weight ?? 1) < 0) ?? block.branches.at(-1);
        if (branch) this.push({ list: listKey.branch(branch.id), index: 0 });
        return false;
      }
      case 'end':
        if (block.ending) {
          const reached = this.persistent[ENDINGS_KEY];
          const list = Array.isArray(reached) ? reached : [];
          if (!list.includes(block.ending.id))
            this.writePersistent(ENDINGS_KEY, [...list, block.ending.id]);
        }
        return this.finish(block);
      case 'fight':
        return this.wait({ kind: 'fight', blockId: block.id });
      case 'action':
        this.s.scene = rememberScene(this.s.scene, block.action, block.params ?? {});
        this.host.runAction?.(block.action, block.params ?? {});
        return false;
      case 'note':
        return false;
    }
  }

  private enter(passageId: string): void {
    const found = this.story.passages.get(passageId);
    if (!found) throw new Error(`Passage "${passageId}" doesn't exist.`);
    const { passage, chapter } = found;
    if (this.s.chapter !== chapter.id) {
      this.s.chapter = chapter.id;
      this.resetScope('chapter');
    }
    this.resetScope('passage');
    this.s.visits = { ...this.s.visits, [passageId]: (this.s.visits[passageId] ?? 0) + 1 };
    const layout = passage.layout ?? chapter.layout ?? this.story.project.layout ?? 'page';
    this.record({ kind: 'passage', passageId, layout, keepPage: passage.keepPage ?? false });
    this.push({ list: listKey.passage(passageId), index: 0 });
  }

  private finish(block: Block | null): boolean {
    this.s.ended = true;
    this.s.frames = [];
    const ending = block?.type === 'end' ? block.ending?.id : undefined;
    return this.wait(
      ending
        ? { kind: 'end', blockId: block?.id ?? null, endingId: ending }
        : { kind: 'end', blockId: block?.id ?? null },
    );
  }

  // --- variables -------------------------------------------------------------------------

  /** Evaluates a parsed formula tree (see formula.ts); never runs JavaScript. */
  private compute(formula: Formula): Value {
    return evaluate(this.story.formula(formula), this.evalContext);
  }

  private num(id: string): number {
    return Number(this.value(id)) || 0;
  }

  private applySet(id: string, op: string, value: Value): void {
    this.write(id, applyOperation(this.value(id), op, value));
  }

  private write(id: string, raw: Value): void {
    const def = this.story.variables.get(id);
    if (!def) return;
    const value = coerceValue(def, raw);
    if (def.scope === 'persistent') this.writePersistent(id, value);
    else this.s.vars = { ...this.s.vars, [id]: value };
  }

  private writePersistent(id: string, value: Value): void {
    this.persistent = { ...this.persistent, [id]: value };
    this.host.onPersistentChange?.(this.persistent);
  }

  private resetScope(scope: Scope): void {
    const vars = { ...this.s.vars };
    for (const def of this.story.variables.values()) {
      if ((def.scope ?? 'game') === scope) delete vars[def.id];
    }
    this.s.vars = vars;
  }

  private snapshotValues(...texts: (LocalText | undefined)[]): Record<string, Value> {
    const values: Record<string, Value> = {};
    for (const text of texts) {
      if (text) for (const id of this.story.textVars(text)) values[id] = this.value(id);
    }
    return values;
  }

  // --- plumbing --------------------------------------------------------------------------

  private randomFloat(): number {
    const { value, state } = nextRandom(this.s.rng);
    this.s.rng = state;
    return value;
  }

  private randomInt(min: number, max: number): number {
    return max < min ? min : min + Math.floor(this.randomFloat() * (max - min + 1));
  }

  private push(frame: Frame): void {
    this.s.frames = [...this.s.frames, frame];
  }

  private record(beat: Beat): void {
    this.s.log = [...this.s.log, beat];
  }

  private wait(beat: Beat): true {
    this.record(beat);
    this.s.waiting = this.s.log.length - 1;
    return true;
  }

  private trimLog(): void {
    const excess = this.s.log.length - LOG_LIMIT;
    if (excess <= 0) return;
    const drop = Math.min(excess, pageStart(this.s.log)); // never drop the page on screen
    if (drop <= 0) return;
    this.s.log = this.s.log.slice(drop);
    if (this.s.waiting !== null) this.s.waiting -= drop;
    this.delivered = Math.max(0, this.delivered - drop);
  }

  private fresh(seed?: number, start?: string): Mutable<StoryState> {
    this.s = emptyState(seed);
    this.enter(start ?? this.story.project.start);
    return this.s;
  }

  /** Fits a saved state to the story as it is now (ADR 0007). */
  private reconcile(state: Mutable<StoryState>): Mutable<StoryState> {
    const restartAt = reconcileState(this.story, state);
    if (restartAt === null) return state;
    state.frames = [];
    state.waiting = null;
    this.s = state;
    this.enter(restartAt);
    return this.s;
  }
}
