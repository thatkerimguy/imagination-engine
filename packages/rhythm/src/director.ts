import {
  nextRandom,
  type Difficulty,
  type EnemyDef,
  type EnemyMove,
  type FightMode,
} from '@ie/story';
import { FILL, MIN_GAP, PATTERNS, pickSubdivision, thin } from './density.ts';

export type NoteKind = 'strike' | 'parry' | 'dodge';

export interface ChartNote {
  /** `bar:index`, stable for a given seed. */
  readonly id: string;
  /** Beats from the start of the fight (bar 0 is the count-in). */
  readonly beat: number;
  readonly kind: NoteKind;
  /** The enemy move it belongs to. */
  readonly move?: string;
  /** Multiplies the enemy's attack if this note gets through. */
  readonly power: number;
  /** Where the note sits on the stage, 0–1 across and down. */
  readonly x: number;
  readonly y: number;
}

/** Who leads a bar. In a free bar the reader may strike on any grid step. */
export type Turn = 'count' | 'enemy' | 'player' | 'free';

export interface BarPlan {
  readonly bar: number;
  readonly turn: Turn;
  /** The first enemy move in the bar, for the HUD to name. */
  readonly move?: EnemyMove;
  readonly notes: readonly ChartNote[];
}

export interface DirectorOptions {
  readonly enemy: EnemyDef;
  readonly mode: FightMode;
  readonly difficulty: Difficulty;
  /** Fight bars, not counting the count-in. */
  readonly bars: number;
  readonly bpm: number;
  readonly beatsPerBar: number;
  readonly seed: number;
  /** Fight bars where the song's sections start (mixed mode). Every 8 bars without them. */
  readonly sectionBars?: readonly number[];
}

/** How likely a free bar is to carry an enemy attack. */
const FREE_ATTACK: Readonly<Record<Difficulty, number>> = { easy: 0.35, normal: 0.5, hard: 0.65 };
/** Share of grid steps the reader tends to land in a free bar, for sizing damage. */
const FREE_LANDING = 0.6;

/** A random stream that depends only on the seed and the bar, so bars can be planned in any order. */
function barRandom(seed: number, bar: number): () => number {
  let state = (seed ^ Math.imul(bar + 1, 0x9e3779b1)) >>> 0;
  return () => {
    const next = nextRandom(state);
    state = next.state;
    return next.value;
  };
}

/**
 * Plans a fight bar by bar (PLAN §6.4). Bar 0 counts in; after it, call & response alternates two
 * enemy bars and two reader bars, free beat lets the reader strike on the grid while attacks keep
 * coming, and mixed switches between the two at each section. Below half HP the enemy turns to its
 * busier moves.
 */
export class FightDirector {
  /** Grid step of the reader's strikes, in beats. */
  readonly grid: number;
  readonly secondsPerBeat: number;
  private readonly sections: readonly number[];

  constructor(readonly options: DirectorOptions) {
    this.grid = pickSubdivision(options.bpm, options.difficulty);
    this.secondsPerBeat = 60 / options.bpm;
    const given = [...(options.sectionBars ?? [])].filter((b) => b > 0 && b < options.bars);
    this.sections =
      given.length > 0
        ? [0, ...new Set(given.sort((a, b) => a - b))]
        : Array.from({ length: Math.ceil(options.bars / 8) }, (_, i) => i * 8);
  }

  /** Bars including the count-in. */
  get totalBars(): number {
    return this.options.bars + 1;
  }

  get totalBeats(): number {
    return this.totalBars * this.options.beatsPerBar;
  }

  /** Call & response or free beat for a bar, and where its stretch of that mode began. */
  modeAt(bar: number): { mode: 'call' | 'free'; since: number } {
    const fightBar = bar - 1;
    const { mode } = this.options;
    if (mode !== 'mixed') return { mode, since: 0 };
    let index = 0;
    for (let i = 0; i < this.sections.length; i++)
      if ((this.sections[i] ?? 0) <= fightBar) index = i;
    return { mode: index % 2 === 0 ? 'call' : 'free', since: this.sections[index] ?? 0 };
  }

  turnAt(bar: number): Turn {
    if (bar <= 0) return 'count';
    const { mode, since } = this.modeAt(bar);
    if (mode === 'free') return 'free';
    return (bar - 1 - since) % 4 < 2 ? 'enemy' : 'player';
  }

  /** The bar's notes. `enemyHp` (0–1) picks the enemy's phase. */
  plan(bar: number, enemyHp = 1): BarPlan {
    const turn = this.turnAt(bar);
    if (turn === 'count' || bar >= this.totalBars) return { bar, turn, notes: [] };
    const random = barRandom(this.options.seed, bar);
    if (turn === 'player') return { bar, turn, notes: this.strikes(bar, random) };
    const attack = turn === 'enemy' || random() < FREE_ATTACK[this.options.difficulty];
    if (!attack) return { bar, turn, notes: [] };
    const from = turn === 'enemy' ? 0 : Math.floor(this.options.beatsPerBar / 2);
    const { notes, first } = this.attacks(bar, from, enemyHp, random);
    return first ? { bar, turn, move: first, notes } : { bar, turn, notes };
  }

  /** Strike notes that land in a full fight played well, for sizing how hard each one hits. */
  expectedStrikes(): number {
    const steps = this.options.beatsPerBar / this.grid;
    let total = 0;
    for (let bar = 1; bar < this.totalBars; bar++) {
      const turn = this.turnAt(bar);
      if (turn === 'player') total += Math.max(1, Math.round(steps * FILL));
      else if (turn === 'free') total += steps * FREE_LANDING;
    }
    return Math.max(1, total);
  }

  private strikes(bar: number, random: () => number): ChartNote[] {
    const { beatsPerBar, difficulty } = this.options;
    const start = bar * beatsPerBar;
    const steps = Math.round(beatsPerBar / this.grid);
    const offsets: number[] = [];
    for (let i = 0; i < steps; i++) if (i === 0 || random() < FILL) offsets.push(i * this.grid);
    return thin(offsets, this.secondsPerBeat, MIN_GAP[difficulty]).map((offset, i) => ({
      id: `${bar}:${i}`,
      beat: start + offset,
      kind: 'strike',
      power: 1,
      // A zig-zag across the lower stage, so the eye can follow the phrase.
      x: 0.2 + 0.6 * ((i % 4) / 3) + (random() - 0.5) * 0.06,
      y: 0.64 + (i % 2) * 0.1,
    }));
  }

  private attacks(
    bar: number,
    from: number,
    enemyHp: number,
    random: () => number,
  ): { notes: ChartNote[]; first?: EnemyMove } {
    const { beatsPerBar, difficulty, enemy } = this.options;
    const start = bar * beatsPerBar;
    const notes: ChartNote[] = [];
    let first: EnemyMove | undefined;
    let cursor = from;
    // One walk around the ellipse per bar, so a new move never starts on top of the last note.
    let angle = random() * Math.PI * 2;
    while (cursor < beatsPerBar) {
      const room = beatsPerBar - cursor;
      const move = this.pickMove(enemy.moves, room, enemyHp, random);
      if (!move) break;
      first ??= move;
      const pattern = PATTERNS[move.pattern];
      const offsets = thin(pattern.offsets, this.secondsPerBeat, MIN_GAP[difficulty]);
      angle += random() * 0.4;
      for (const offset of offsets) {
        const a = angle;
        angle += 1;
        notes.push({
          id: `${bar}:${notes.length}`,
          beat: start + cursor + offset,
          kind: move.answer,
          move: move.id,
          power: move.power ?? 1,
          x: 0.5 + Math.cos(a) * 0.28,
          y: 0.32 + Math.sin(a) * 0.12,
        });
      }
      // Easy fights leave a beat to breathe between moves; free bars hold one move at most.
      cursor += pattern.span + (difficulty === 'easy' ? 1 : 0);
      if (from > 0) break;
    }
    return first ? { notes, first } : { notes };
  }

  private pickMove(
    moves: readonly EnemyMove[],
    room: number,
    enemyHp: number,
    random: () => number,
  ): EnemyMove | undefined {
    const fitting = moves.filter((m) => PATTERNS[m.pattern].span <= room);
    if (fitting.length === 0) return undefined;
    // Below half HP the enemy favours moves with more notes: its second phase.
    const weight = (m: EnemyMove) =>
      enemyHp < 0.5
        ? PATTERNS[m.pattern].offsets.length
        : 1 + 1 / PATTERNS[m.pattern].offsets.length;
    const total = fitting.reduce((sum, m) => sum + weight(m), 0);
    let roll = random() * total;
    return fitting.find((m) => (roll -= weight(m)) < 0) ?? fitting.at(-1);
  }
}
