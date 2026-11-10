import type { Difficulty, FightResult } from '@ie/story';
import {
  FightDirector,
  type BarPlan,
  type ChartNote,
  type DirectorOptions,
  type NoteKind,
} from './director.ts';
import { GRADE_VALUE, gradeFor, WIDE_WINDOWS, WINDOWS, type Grade } from './judge.ts';

/** Converts between fight beats (0 = start of the count-in) and heard time in seconds. */
export interface FightClock {
  timeAt(beat: number): number;
  beatAt(time: number): number;
}

export interface Assist {
  /** Wider timing windows. */
  readonly wide?: boolean;
  /** The reader can't lose: HP stops at 1 and the fight counts as won. */
  readonly noFail?: boolean;
  /** Every note is hit perfectly on its own. */
  readonly auto?: boolean;
}

export interface FightOptions extends DirectorOptions {
  readonly clock: FightClock;
  readonly assist?: Assist;
}

export type FightEvent =
  | {
      readonly type: 'judged';
      /** The charted note, or null for a strike placed freely on the grid. */
      readonly note: LiveNote | null;
      readonly kind: NoteKind;
      readonly grade: Grade;
      readonly enemyDamage: number;
      readonly playerDamage: number;
    }
  | { readonly type: 'bar'; readonly plan: BarPlan }
  | { readonly type: 'phase'; readonly phase: 2 }
  | { readonly type: 'end'; readonly result: FightResult };

export interface LiveNote extends ChartNote {
  /** Heard time of the note, in seconds. */
  readonly time: number;
  grade?: Grade;
}

const ATTACK_SCALE: Readonly<Record<Difficulty, number>> = { easy: 0.6, normal: 1, hard: 1.4 };
/** Share of perfect strikes that fells the enemy by the end of the fight. */
const STRIKE_SHARE = 0.85;
const PLAN_AHEAD_BARS = 2;

/**
 * One fight in progress: plans bars just ahead of the music, judges the reader's taps and swipes,
 * counts misses as notes pass, and keeps HP, combo and score. Time comes in from outside (the
 * conductor), so a test can play a whole fight in a loop.
 */
export class FightSession {
  readonly director: FightDirector;
  readonly enemyMax: number;
  enemyHp: number;
  playerHp = 100;
  combo = 0;
  maxCombo = 0;
  readonly counts: Record<Grade, number> = { perfect: 0, great: 0, good: 0, miss: 0 };
  readonly notes: LiveNote[] = [];
  readonly plans: BarPlan[] = [];
  phase: 1 | 2 = 1;
  result: FightResult | null = null;
  private readonly scale: number;
  private readonly strikeDamage: number;
  private scoreSum = 0;
  private scoreCount = 0;
  private lastFreeSlot = Number.NEGATIVE_INFINITY;
  private bar = -1;
  /** Index of the first note not yet judged. */
  private cursor = 0;

  constructor(private readonly options: FightOptions) {
    this.director = new FightDirector(options);
    this.enemyMax = options.enemy.hp ?? 100;
    this.enemyHp = this.enemyMax;
    this.scale = options.assist?.wide ? WIDE_WINDOWS : 1;
    this.strikeDamage = this.enemyMax / (this.director.expectedStrikes() * STRIKE_SHARE);
  }

  get done(): boolean {
    return this.result !== null;
  }

  /** The score so far, 0–100. */
  get score(): number {
    return this.scoreCount === 0 ? 0 : (100 * this.scoreSum) / this.scoreCount;
  }

  /** Who leads the bar playing at `time`. */
  turnAt(time: number): BarPlan['turn'] {
    return this.director.turnAt(
      Math.floor(this.options.clock.beatAt(time) / this.options.beatsPerBar),
    );
  }

  /** Moves the fight to `time`: plans bars, plays assists, counts misses, and ends it. */
  update(time: number): FightEvent[] {
    if (this.result) return [];
    const events: FightEvent[] = [];
    const { clock, beatsPerBar } = this.options;
    const beat = clock.beatAt(time);
    while (
      this.plans.length < this.director.totalBars &&
      this.plans.length * beatsPerBar <= beat + PLAN_AHEAD_BARS * beatsPerBar
    )
      this.planBar(this.plans.length);
    const bar = Math.floor(beat / beatsPerBar);
    if (bar !== this.bar && bar >= 0 && bar < this.director.totalBars) {
      this.bar = bar;
      const plan = this.plans[bar];
      if (plan) events.push({ type: 'bar', plan });
    }
    const late = WINDOWS.good * this.scale;
    for (let i = this.cursor; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (!note || note.grade) continue;
      if (this.options.assist?.auto && note.time <= time) events.push(this.judge(note, 'perfect'));
      else if (note.time + late < time) events.push(this.judge(note, 'miss'));
      else if (note.time > time) break;
    }
    this.advanceCursor();
    this.checkEnd(beat >= this.director.totalBeats, events);
    return events;
  }

  /** The reader tapped (strike or parry) or swiped (dodge) at heard `time`. */
  input(action: 'tap' | 'swipe', time: number): FightEvent[] {
    if (this.result || this.options.assist?.auto) return [];
    const events: FightEvent[] = [];
    const window = WINDOWS.good * this.scale;
    const wants = (n: LiveNote) => (action === 'swipe' ? n.kind === 'dodge' : n.kind !== 'dodge');
    let best: LiveNote | null = null;
    let wrong: LiveNote | null = null;
    for (let i = this.cursor; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (!note || note.grade) continue;
      if (note.time - time > window) break;
      if (Math.abs(note.time - time) > window) continue;
      if (wants(note)) {
        if (!best || Math.abs(note.time - time) < Math.abs(best.time - time)) best = note;
      } else wrong ??= note;
    }
    if (best) {
      events.push(this.judge(best, gradeFor(time - best.time, this.scale) ?? 'miss'));
    } else if (wrong) {
      // A tap at a dodge, or a swipe at a parry: the attack gets through.
      events.push(this.judge(wrong, 'miss'));
    } else if (action === 'tap' && this.turnAt(time) === 'free') {
      events.push(...this.freeStrike(time));
    } else {
      this.combo = 0; // a stray tap breaks the combo but costs nothing else
    }
    this.advanceCursor();
    this.checkEnd(false, events);
    return events;
  }

  private planBar(bar: number): void {
    const plan = this.director.plan(bar, this.enemyHp / this.enemyMax);
    this.plans.push(plan);
    for (const note of plan.notes)
      this.notes.push({ ...note, time: this.options.clock.timeAt(note.beat) });
  }

  private freeStrike(time: number): FightEvent[] {
    const { clock } = this.options;
    const grid = this.director.grid;
    const slot = Math.round(clock.beatAt(time) / grid);
    if (slot === this.lastFreeSlot) return []; // one strike per grid step
    this.lastFreeSlot = slot;
    const grade = gradeFor(time - clock.timeAt(slot * grid), this.scale) ?? 'miss';
    return [this.apply(grade, 'strike', null)];
  }

  private judge(note: LiveNote, grade: Grade): FightEvent {
    note.grade = grade;
    return this.apply(grade, note.kind, note);
  }

  private apply(grade: Grade, kind: NoteKind, note: LiveNote | null): FightEvent {
    this.counts[grade]++;
    this.scoreSum += GRADE_VALUE[grade];
    this.scoreCount++;
    if (grade === 'miss') this.combo = 0;
    else this.maxCombo = Math.max(this.maxCombo, ++this.combo);
    let enemyDamage = 0;
    let playerDamage = 0;
    if (kind === 'strike') enemyDamage = this.strikeDamage * GRADE_VALUE[grade];
    else if (grade === 'miss')
      playerDamage =
        (this.options.enemy.attack ?? 8) *
        (note?.power ?? 1) *
        ATTACK_SCALE[this.options.difficulty];
    this.enemyHp = Math.max(0, this.enemyHp - enemyDamage);
    this.playerHp = Math.max(this.options.assist?.noFail ? 1 : 0, this.playerHp - playerDamage);
    return { type: 'judged', note, kind, grade, enemyDamage, playerDamage };
  }

  private advanceCursor(): void {
    while (this.notes[this.cursor]?.grade) this.cursor++;
  }

  private checkEnd(timeUp: boolean, events: FightEvent[]): void {
    if (this.result) return;
    if (this.phase === 1 && this.enemyHp / this.enemyMax < 0.5) {
      this.phase = 2;
      events.push({ type: 'phase', phase: 2 });
    }
    const felled = this.enemyHp <= 0;
    const fallen = this.playerHp <= 0;
    if (!felled && !fallen && !timeUp) return;
    // At time up, whoever has more of their HP left takes it.
    const won =
      this.options.assist?.noFail === true ||
      felled ||
      (!fallen && this.enemyHp / this.enemyMax <= this.playerHp / 100);
    this.result = { won, score: Math.round(this.score) };
    events.push({ type: 'end', result: this.result });
  }
}
