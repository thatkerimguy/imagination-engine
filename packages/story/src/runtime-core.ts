import type { Value } from '@ie/core';
import type { OptionContext } from './choices.ts';
import { defaultValue, listKey, type CompiledStory } from './compile.ts';
import { nextRandom } from './dice.ts';
import { evaluate, truthy, valueText, type EvalContext } from './formula.ts';
import { eventKey, type RuleEvent } from './logic.ts';
import type { StoryHost } from './runtime-options.ts';
import type { Block, Formula, LocalText, Scope } from './schema.ts';
import { emptyState, type Beat, type Frame, type Mutable, type StoryState } from './state.ts';
import { applyOperation, coerceValue } from './variables.ts';

/**
 * The interpreter's working parts, shared by the block runner, the RPG blocks, battles and rules
 * (ADR 0017): the state, variables and routine inputs, the seeded random numbers, the log and the
 * stack. `StoryRuntime` wraps it with the API hosts use.
 */
export class RuntimeCore {
  s: Mutable<StoryState> = emptyState();
  persistent: Record<string, Value>;
  readonly evalContext: EvalContext;
  readonly optionContext: OptionContext;
  /** Event keys some rule listens for; other events aren't queued at all. */
  private readonly listened: ReadonlySet<string>;

  constructor(
    readonly story: CompiledStory,
    readonly host: StoryHost,
    persistent: Readonly<Record<string, Value>> = {},
  ) {
    this.persistent = { ...persistent };
    this.listened = new Set((story.project.rules ?? []).map((r) => eventKey(r.on, r.target)));
    this.evalContext = {
      value: (id) => this.value(id),
      visits: (id) => this.s.visits[id] ?? 0,
      chosen: (id) => this.s.chosen[id] ?? 0,
      random: (min, max) => this.randomInt(min, max),
      owned: (id) => this.s.inv?.[id] ?? 0,
      quest: (id) => this.s.quests?.[id]?.status ?? 'none',
    };
    this.optionContext = {
      compute: (formula) => this.compute(formula),
      num: (id) => this.num(id),
      timesChosen: (id) => this.s.chosen[id] ?? 0,
      formula: (formula) => story.formula(formula),
    };
  }

  /** The beat waiting for the reader, if any. */
  get waiting(): Beat | null {
    return this.s.waiting === null ? null : (this.s.log[this.s.waiting] ?? null);
  }

  // --- variables -------------------------------------------------------------------------

  value(id: string): Value {
    const at = this.localAt(id);
    if (at >= 0) return this.s.frames[at]?.locals?.[id] ?? null;
    const def = this.story.variables.get(id);
    if (!def) return null;
    const stored = def.scope === 'persistent' ? this.persistent[id] : this.s.vars[id];
    return stored === undefined ? defaultValue(def) : stored;
  }

  /** Evaluates a parsed formula tree (see formula.ts); never runs JavaScript. */
  compute(formula: Formula): Value {
    return evaluate(this.story.formula(formula), this.evalContext);
  }

  num(id: string): number {
    return Number(this.value(id)) || 0;
  }

  applySet(id: string, op: string, value: Value): void {
    this.write(id, applyOperation(this.value(id), op, value));
  }

  write(id: string, raw: Value): void {
    const at = this.localAt(id);
    if (at >= 0) return this.writeLocal(at, id, raw);
    const def = this.story.variables.get(id);
    if (!def) return;
    const value = coerceValue(def, raw);
    const watched = this.listens('changed', id);
    const before = watched ? JSON.stringify(this.value(id)) : '';
    if (def.scope === 'persistent') this.writePersistent(id, value);
    else this.s.vars = { ...this.s.vars, [id]: value };
    if (watched && before !== JSON.stringify(value)) this.raise('changed', id);
  }

  writePersistent(id: string, value: Value): void {
    this.persistent = { ...this.persistent, [id]: value };
    this.host.onPersistentChange?.(this.persistent);
  }

  resetScope(scope: Scope): void {
    const vars = { ...this.s.vars };
    for (const def of this.story.variables.values()) {
      if ((def.scope ?? 'game') === scope) delete vars[def.id];
    }
    this.s.vars = vars;
  }

  snapshotValues(...texts: (LocalText | undefined)[]): Record<string, Value> {
    const values: Record<string, Value> = {};
    for (const text of texts) {
      if (text) for (const id of this.story.textVars(text)) values[id] = this.value(id);
    }
    return values;
  }

  /**
   * The frame holding a routine input of this name: searched from the top of the stack down to
   * the routine's call boundary, so a routine never sees its caller's inputs.
   */
  private localAt(id: string): number {
    const frames = this.s.frames;
    for (let i = frames.length - 1; i >= 0; i--) {
      const frame = frames[i];
      if (frame?.locals && id in frame.locals) return i;
      if (frame?.call) return -1;
    }
    return -1;
  }

  /** Inputs keep the type they were given: a number input stays a number. */
  private writeLocal(at: number, id: string, raw: Value): void {
    const frame = this.s.frames[at];
    if (!frame) return;
    const old = frame.locals?.[id];
    const value =
      typeof old === 'number'
        ? Number(raw) || 0
        : typeof old === 'boolean'
          ? truthy(raw)
          : valueText(raw);
    const frames = [...this.s.frames];
    frames[at] = { ...frame, locals: { ...frame.locals, [id]: value } };
    this.s.frames = frames;
  }

  // --- rules -----------------------------------------------------------------------------

  listens(on: RuleEvent, target: string): boolean {
    return this.listened.has(eventKey(on, target)) || this.listened.has(eventKey(on));
  }

  /** Queues an event for the rules; they fire before the next block runs (see rules.ts). */
  raise(on: RuleEvent, target: string): void {
    if (this.listens(on, target)) this.s.events = [...(this.s.events ?? []), eventKey(on, target)];
  }

  // --- stack and log ---------------------------------------------------------------------

  enter(passageId: string): void {
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
    this.raise('entered', passageId);
  }

  finish(block: Block | null): boolean {
    this.s.ended = true;
    this.s.frames = [];
    const ending = block?.type === 'end' ? block.ending?.id : undefined;
    return this.wait(
      ending
        ? { kind: 'end', blockId: block?.id ?? null, endingId: ending }
        : { kind: 'end', blockId: block?.id ?? null },
    );
  }

  push(frame: Frame): void {
    this.s.frames = [...this.s.frames, frame];
  }

  record(beat: Beat): void {
    this.s.log = [...this.s.log, beat];
  }

  wait(beat: Beat): true {
    this.record(beat);
    this.s.waiting = this.s.log.length - 1;
    return true;
  }

  // --- random numbers --------------------------------------------------------------------

  randomFloat(): number {
    const { value, state } = nextRandom(this.s.rng);
    this.s.rng = state;
    return value;
  }

  randomInt(min: number, max: number): number {
    return max < min ? min : min + Math.floor(this.randomFloat() * (max - min + 1));
  }
}
