import type { BeatmapDef } from '@ie/story';
import { autoAim } from './autoplay.ts';
import {
  ballAt,
  BREAK_GAP,
  FIELD_CENTRE,
  prepareObjects,
  type CheckpointKind,
  type PlayObject,
} from './prepare.ts';
import {
  healthChange,
  judgeOffset,
  JUDGEMENT_VALUE,
  rankFor,
  type Judgement,
  type PlayRules,
  type Rank,
} from './rules.ts';

export type PlayEvent =
  | {
      readonly kind: 'judged';
      readonly index: number;
      readonly judgement: Judgement;
      readonly x: number;
      readonly y: number;
      /** Milliseconds early (negative) or late; null when no tap judged it. */
      readonly offset: number | null;
    }
  | {
      readonly kind: 'part';
      readonly index: number;
      readonly part: 'head' | CheckpointKind;
      readonly ok: boolean;
      readonly x: number;
      readonly y: number;
      readonly offset?: number;
    }
  | { readonly kind: 'comboBreak'; readonly combo: number }
  | { readonly kind: 'failed' }
  | { readonly kind: 'finished' };

export interface PlayStats {
  score: number;
  combo: number;
  maxCombo: number;
  readonly counts: Record<Judgement, number>;
  health: number;
}

export interface PlayResult {
  readonly won: boolean;
  readonly failed: boolean;
  readonly accuracy: number;
  readonly rank: Rank;
  readonly score: number;
  readonly maxCombo: number;
  readonly counts: Readonly<Record<Judgement, number>>;
  /** Mean tap offset in ms (positive: late). */
  readonly meanOffset: number;
  /** Standard deviation of tap offsets in ms. */
  readonly spread: number;
}

/** Spins faster than this don't count (a spinning mouse wheel of a hand would break it). */
const MAX_SPINS_PER_SECOND = 8;
/** A slider's end is checked this long before it, so a quick release still counts. */
const END_LENIENCY = 36;
const TAU = Math.PI * 2;

interface SliderState {
  hits: number;
  next: number;
  tracking: boolean;
}
interface SpinState {
  angle: number | null;
  total: number;
  bonus: number;
}

/**
 * One play of a beatmap, judged in song milliseconds. Pure: the view feeds it taps, releases,
 * aim and the song clock, and draws what it reports. Only the earliest note waiting can be hit,
 * so a tap never lands on a note further ahead.
 */
export class BeatmapSession {
  readonly objects: readonly PlayObject[];
  readonly stats: PlayStats = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    counts: { perfect: 0, great: 0, good: 0, miss: 0 },
    health: 1,
  };
  /** Every judged tap's offset, oldest first. */
  readonly offsets: number[] = [];
  readonly cursor: { x: number; y: number } = { x: FIELD_CENTRE.x, y: FIELD_CENTRE.y };
  failed = false;
  finished = false;

  private held = 0;
  private next = 0;
  private lastT = Number.NEGATIVE_INFINITY;
  private readonly headDone: boolean[];
  private readonly done: boolean[];
  private readonly sliders = new Map<number, SliderState>();
  private readonly spins = new Map<number, SpinState>();
  private readonly breaks: readonly { readonly from: number; readonly to: number }[];
  private readonly health: ReturnType<typeof healthChange>;
  private readonly lastEnd: number;
  private events: PlayEvent[] = [];
  private readonly ball = { x: 0, y: 0 };

  constructor(
    map: BeatmapDef,
    readonly rules: PlayRules,
  ) {
    this.objects = prepareObjects(map, rules);
    this.headDone = this.objects.map((o) => o.kind === 'spinner');
    this.done = this.objects.map(() => false);
    this.health = healthChange(rules.drain);
    const breaks: { from: number; to: number }[] = [];
    for (let i = 1; i < this.objects.length; i++) {
      const a = this.objects[i - 1] as PlayObject;
      const b = this.objects[i] as PlayObject;
      if (b.t - a.end > BREAK_GAP) breaks.push({ from: a.end, to: b.t - this.rules.preempt });
    }
    this.breaks = breaks;
    this.lastEnd = this.objects.reduce((m, o) => Math.max(m, o.end), 0);
  }

  get firstTime(): number {
    return this.objects[0]?.t ?? 0;
  }

  get endTime(): number {
    return this.lastEnd;
  }

  get accuracy(): number {
    const c = this.stats.counts;
    const n = c.perfect + c.great + c.good + c.miss;
    if (n === 0) return 1;
    return (300 * c.perfect + 100 * c.great + 50 * c.good) / (300 * n);
  }

  /** True between notes far enough apart to rest (the HUD says so; health holds). */
  inBreak(t: number): boolean {
    return this.breaks.some((b) => t >= b.from && t < b.to);
  }

  isDone(i: number): boolean {
    return this.done[i] === true;
  }

  isHeadDone(i: number): boolean {
    return this.headDone[i] === true;
  }

  isTracking(i: number): boolean {
    return this.sliders.get(i)?.tracking === true;
  }

  takeEvents(): PlayEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  move(x: number, y: number): void {
    this.cursor.x = x;
    this.cursor.y = y;
  }

  /** A key, button or finger went down at `t`. Returns what it did, for feedback. */
  press(t: number, x = this.cursor.x, y = this.cursor.y): 'hit' | 'early' | 'none' {
    this.held++;
    this.move(x, y);
    if (this.failed || this.rules.auto) return 'none';
    const i = this.headDone.indexOf(false, this.next);
    const o = i >= 0 ? this.objects[i] : undefined;
    if (!o || o.t - t > this.rules.preempt) return 'none';
    // Touch is less precise than a mouse: a little more room around the circle.
    if (Math.hypot(x - o.x, y - o.y) > this.rules.radius * 1.1) return 'none';
    if (judgeOffset(t - o.t, this.rules) === null) return t < o.t ? 'early' : 'none';
    this.hitHead(i, t);
    return 'hit';
  }

  release(): void {
    this.held = Math.max(0, this.held - 1);
  }

  /** Advances the song clock to `t`: misses, slider checks, spinners, health. */
  update(t: number): void {
    if (this.failed || this.finished) return;
    const dt = Math.max(0, Math.min(100, t - this.lastT));
    this.lastT = t;
    if (this.rules.auto) this.autoplay(t);
    const { good } = this.rules.windows;
    for (let i = this.next; i < this.objects.length; i++) {
      const o = this.objects[i] as PlayObject;
      if (o.t - this.rules.preempt > t) break;
      if (this.done[i]) continue;
      if (!this.headDone[i] && t > o.t + good) {
        if (o.kind === 'circle') this.finish(i, 'miss', null);
        else this.missHead(i);
      }
      if (o.kind === 'slider' && t >= o.t) this.trackSlider(i, o, t);
      if (o.kind === 'spinner' && t >= o.t) this.spin(i, o, t, dt);
    }
    while (this.next < this.objects.length && this.done[this.next]) this.next++;
    this.drain(t, dt);
    if (this.next >= this.objects.length && t >= this.lastEnd) {
      this.finished = true;
      this.events.push({ kind: 'finished' });
    }
  }

  result(pass = 0): PlayResult {
    const accuracy = this.accuracy;
    const n = this.offsets.length;
    const mean = n ? this.offsets.reduce((a, b) => a + b, 0) / n : 0;
    const spread = n ? Math.sqrt(this.offsets.reduce((a, b) => a + (b - mean) ** 2, 0) / n) : 0;
    return {
      won: !this.failed && accuracy * 100 >= pass,
      failed: this.failed,
      accuracy,
      rank: rankFor(accuracy, this.stats.counts.miss),
      score: this.stats.score,
      maxCombo: this.stats.maxCombo,
      counts: { ...this.stats.counts },
      meanOffset: mean,
      spread,
    };
  }

  private hitHead(i: number, t: number): void {
    const o = this.objects[i] as PlayObject;
    const offset = t - o.t;
    const judgement = judgeOffset(offset, this.rules) ?? 'good';
    this.headDone[i] = true;
    this.offsets.push(offset);
    if (o.kind === 'circle') {
      this.finish(i, judgement, offset);
      return;
    }
    const state = this.slider(i);
    state.hits++;
    state.tracking = true;
    this.addCombo(30);
    this.events.push({ kind: 'part', index: i, part: 'head', ok: true, x: o.x, y: o.y, offset });
  }

  private missHead(i: number): void {
    const o = this.objects[i] as PlayObject;
    this.headDone[i] = true;
    this.breakCombo();
    this.events.push({ kind: 'part', index: i, part: 'head', ok: false, x: o.x, y: o.y });
  }

  private slider(i: number): SliderState {
    let state = this.sliders.get(i);
    if (!state) {
      state = { hits: 0, next: 0, tracking: false };
      this.sliders.set(i, state);
    }
    return state;
  }

  private trackSlider(i: number, o: PlayObject, t: number): void {
    const state = this.slider(i);
    ballAt(o, t, this.ball);
    const reach = state.tracking ? this.rules.radius * 2.4 : this.rules.radius;
    const near = Math.hypot(this.cursor.x - this.ball.x, this.cursor.y - this.ball.y) <= reach;
    state.tracking = this.held > 0 && near;
    while (state.next < o.checkpoints.length) {
      const cp = o.checkpoints[state.next];
      if (!cp) break;
      const due = cp.kind === 'end' ? Math.max(o.t, cp.t - END_LENIENCY) : cp.t;
      if (t < due) break;
      state.next++;
      const ok = state.tracking;
      if (ok) {
        state.hits++;
        this.addCombo(cp.kind === 'tick' ? 10 : 30);
        this.stats.health = Math.min(1, this.stats.health + this.health.tick);
      } else if (cp.kind !== 'end') {
        this.breakCombo();
        this.stats.health = Math.max(0, this.stats.health - this.health.miss / 3);
      }
      this.events.push({ kind: 'part', index: i, part: cp.kind, ok, x: cp.x, y: cp.y });
    }
    if (state.next >= o.checkpoints.length && this.headDone[i]) {
      const fraction = state.hits / (o.checkpoints.length + 1);
      const judgement: Judgement =
        fraction >= 1 ? 'perfect' : fraction >= 0.5 ? 'great' : fraction > 0 ? 'good' : 'miss';
      this.finish(i, judgement, null, false);
    }
  }

  private spin(i: number, o: PlayObject, t: number, dt: number): void {
    let state = this.spins.get(i);
    if (!state) {
      state = { angle: null, total: 0, bonus: 0 };
      this.spins.set(i, state);
    }
    const needed = Math.max(1, Math.floor(((o.end - o.t) / 1000) * this.rules.spinRate));
    if (t <= o.end) {
      if (this.held > 0) {
        const angle = Math.atan2(this.cursor.y - o.y, this.cursor.x - o.x);
        if (state.angle !== null) {
          let delta = angle - state.angle;
          if (delta > Math.PI) delta -= TAU;
          if (delta < -Math.PI) delta += TAU;
          const cap = (MAX_SPINS_PER_SECOND * TAU * dt) / 1000;
          state.total += Math.min(Math.abs(delta), cap);
        }
        state.angle = angle;
      } else {
        state.angle = null;
      }
      const spins = Math.floor(state.total / TAU);
      while (spins - needed > state.bonus) {
        state.bonus++;
        this.stats.score += 100;
      }
      return;
    }
    const spins = state.total / TAU;
    const judgement: Judgement =
      spins >= needed
        ? 'perfect'
        : spins >= needed * 0.75
          ? 'great'
          : spins >= needed * 0.5
            ? 'good'
            : 'miss';
    this.finish(i, judgement, null);
  }

  /** Spins counted so far and spins needed, for the spinner's meter. */
  spinProgress(i: number): { spins: number; needed: number } {
    const o = this.objects[i];
    const total = this.spins.get(i)?.total ?? 0;
    const needed = o ? Math.max(1, Math.floor(((o.end - o.t) / 1000) * this.rules.spinRate)) : 1;
    return { spins: total / TAU, needed };
  }

  private finish(i: number, judgement: Judgement, offset: number | null, combo = true): void {
    if (this.done[i]) return;
    const o = this.objects[i] as PlayObject;
    this.done[i] = true;
    this.headDone[i] = true;
    this.stats.counts[judgement]++;
    if (judgement === 'miss') {
      this.breakCombo();
      this.stats.health = Math.max(0, this.stats.health - this.health.miss);
    } else {
      if (combo) this.stats.combo++;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
      this.stats.score += Math.round(JUDGEMENT_VALUE[judgement] * (1 + this.stats.combo / 25));
      this.stats.health = Math.min(1, this.stats.health + this.health.gain[judgement]);
    }
    this.events.push({ kind: 'judged', index: i, judgement, x: o.endX, y: o.endY, offset });
  }

  private addCombo(points: number): void {
    this.stats.combo++;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
    this.stats.score += points;
  }

  private breakCombo(): void {
    if (this.stats.combo >= 10) this.events.push({ kind: 'comboBreak', combo: this.stats.combo });
    this.stats.combo = 0;
  }

  private drain(t: number, dt: number): void {
    if (t < this.firstTime || t > this.lastEnd || this.inBreak(t)) return;
    this.stats.health = Math.max(0, this.stats.health - (this.health.perSecond * dt) / 1000);
    if (this.stats.health <= 0 && !this.rules.noFail && !this.rules.auto) {
      this.failed = true;
      this.events.push({ kind: 'failed' });
    }
  }

  /** Watch: perfect taps, the cursor gliding between notes and riding sliders. */
  private autoplay(t: number): void {
    for (let i = this.next; i < this.objects.length; i++) {
      const o = this.objects[i] as PlayObject;
      if (o.t > t) break;
      if (this.headDone[i]) continue;
      this.move(o.x, o.y);
      this.hitHead(i, o.t);
    }
    this.held = autoAim(this.objects, this.next, t, this.rules.spinRate, this.cursor) ? 1 : 0;
  }
}
