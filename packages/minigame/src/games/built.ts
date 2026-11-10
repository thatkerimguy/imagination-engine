import {
  BUILT_ROLL,
  BUILT_TIME,
  type BuiltAction,
  type BuiltCondition,
  type BuiltEvent,
  type BuiltGame,
  type BuiltRule,
} from '@ie/story';
import { clamp, defineMinigame, score } from '../types.ts';

/*
 * A game put together in the Studio (ADR 0025): meters, buttons, dice and a clock, driven by the
 * author's rules. Inputs: `pick` taps button n, `press` rolls the dice.
 */

export interface BuiltState {
  readonly game: BuiltGame;
  /** The dice's random source as a plain number, so the state stays data (seeded, comparable). */
  rng: number;
  /** Time limit in seconds after the reader's ease, or null without a clock. */
  readonly limit: number | null;
  readonly values: Map<string, number>;
  /** The faces of the last roll; empty before the first. */
  faces: number[];
  elapsed: number;
  /** Whole seconds already announced to `second` rules. */
  seconds: number;
  outcome: 'won' | 'lost' | null;
  /** Seconds the dice still tumble for; the next roll waits. */
  tumbling: number;
  /** Counts meter changes, so the view repaints only when something moved. */
  version: number;
}

const TUMBLE = 0.4;
/** A chain of `change` rules that keeps changing meters stops here instead of looping forever. */
const MAX_CHAIN = 8;

/** One step of mulberry32 on the state's own seed (same generator as seededRandom). */
function nextRandom(s: BuiltState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const builtTotal = (s: BuiltState): number => s.faces.reduce((a, b) => a + b, 0);

function read(s: BuiltState, of: string): number {
  if (of === BUILT_ROLL) return builtTotal(s);
  if (of === BUILT_TIME) return Math.floor(s.elapsed);
  return s.values.get(of) ?? 0;
}

function holds(s: BuiltState, c: BuiltCondition): boolean {
  const v = read(s, c.of);
  switch (c.op) {
    case '<':
      return v < c.value;
    case '<=':
      return v <= c.value;
    case '=':
      return v === c.value;
    case '>=':
      return v >= c.value;
    case '>':
      return v > c.value;
  }
}

/** Applies one action. Returns true when a meter changed. */
function act(s: BuiltState, a: BuiltAction): boolean {
  if (a.do === 'win' || a.do === 'lose') {
    s.outcome ??= a.do === 'win' ? 'won' : 'lost';
    return false;
  }
  const meter = s.game.meters.find((m) => m.id === a.meter);
  if (!meter) return false; // a rule left pointing at a removed meter does nothing
  const before = s.values.get(meter.id) ?? 0;
  const amount = a.do === 'addRoll' ? builtTotal(s) : (a.value ?? 0);
  const next = a.do === 'set' ? amount : a.do === 'subtract' ? before - amount : before + amount;
  const value = clamp(Math.round(next), 0, meter.max);
  s.values.set(meter.id, value);
  return value !== before;
}

/** Runs the rules for one event, then `change` rules while meters keep changing. */
function fire(s: BuiltState, event: BuiltEvent, button?: string): void {
  let changed = run(s, (r) => r.on === event && (event !== 'tap' || r.button === button));
  let any = changed;
  for (let i = 0; changed && i < MAX_CHAIN && !s.outcome; i++) {
    changed = run(s, (r) => r.on === 'change');
    any ||= changed;
  }
  if (any) s.version++;
}

function run(s: BuiltState, match: (r: BuiltRule) => boolean): boolean {
  let changed = false;
  for (const rule of s.game.rules) {
    if (s.outcome) break;
    if (!match(rule) || !(rule.if ?? []).every((c) => holds(s, c))) continue;
    for (const a of rule.then) if (act(s, a)) changed = true;
  }
  return changed;
}

export const built = defineMinigame<BuiltGame, BuiltState>({
  id: 'built',
  setup(game, ctx) {
    const s: BuiltState = {
      game,
      rng: Math.floor(ctx.random() * 4294967296),
      limit: game.seconds ? game.seconds * ctx.ease : null,
      values: new Map(game.meters.map((m) => [m.id, clamp(m.start ?? 0, 0, m.max)])),
      faces: [],
      elapsed: 0,
      seconds: 0,
      outcome: null,
      tumbling: 0,
      version: 0,
    };
    fire(s, 'start');
    return s;
  },
  update(s, dt) {
    if (s.outcome) return;
    if (s.tumbling > 0) s.tumbling = Math.max(0, s.tumbling - dt);
    s.elapsed += dt;
    while (!s.outcome && s.seconds + 1 <= s.elapsed) {
      s.seconds += 1;
      fire(s, 'second');
    }
    if (!s.outcome && s.limit !== null && s.elapsed >= s.limit) {
      fire(s, 'timeout');
      s.outcome ??= s.game.timeout === 'win' ? 'won' : 'lost';
    }
  },
  onInput(s, input) {
    if (s.outcome) return;
    if (input.kind === 'pick') {
      const button = s.game.buttons[input.index];
      if (button) fire(s, 'tap', button.id);
    } else if (input.kind === 'press' && s.game.dice && s.tumbling <= 0) {
      const { count, sides } = s.game.dice;
      s.faces = Array.from({ length: count }, () => 1 + Math.floor(nextRandom(s) * sides));
      s.tumbling = TUMBLE;
      fire(s, 'roll');
    }
  },
  result(s) {
    if (!s.outcome) return null;
    const won = s.outcome === 'won';
    const meter = s.game.meters.find((m) => m.id === s.game.scoreMeter);
    const share = meter ? (s.values.get(meter.id) ?? 0) / meter.max : won ? 1 : 0;
    return { won, score: score(share * 100), values: Object.fromEntries(s.values) };
  },
  timeLeft(s) {
    return s.limit === null ? null : clamp(1 - s.elapsed / s.limit, 0, 1);
  },
});
