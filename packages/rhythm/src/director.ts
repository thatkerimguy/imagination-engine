import {
  nextRandom,
  type Difficulty,
  type EnemyDef,
  type EnemyMove,
  type FightMode,
  type SequenceDef,
} from '@ie/story';
import { FILL, MIN_GAP, pickSubdivision, thin } from './density.ts';
import {
  chartBars,
  moveShape,
  thinShape,
  type MoveShape,
  type NoteKind,
  type ShapeNote,
} from './shapes.ts';

export type { NoteKind } from './shapes.ts';

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
  /** Sequences whose choreography starts in this bar, at fight beats (ADR 0019). */
  readonly cues?: readonly { readonly beat: number; readonly sequence: string }[];
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
  /** The project's sequences, for moves that name a move sequence. */
  readonly sequences?: readonly SequenceDef[];
  /** A hand-made chart: its notes are the fight, and its length sets the bars. */
  readonly chart?: SequenceDef;
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
  /** Fight bars, not counting the count-in. */
  readonly bars: number;
  private readonly sections: readonly number[];
  private readonly shapes = new Map<string, MoveShape>();
  private readonly chart: readonly ShapeNote[][] | null;

  constructor(readonly options: DirectorOptions) {
    this.grid = pickSubdivision(options.bpm, options.difficulty);
    this.secondsPerBeat = 60 / options.bpm;
    this.chart = options.chart ? chartBars(options.chart, options.beatsPerBar) : null;
    this.bars = this.chart?.length ?? options.bars;
    for (const move of options.enemy.moves)
      this.shapes.set(move.id, moveShape(move, options.sequences, options.beatsPerBar));
    const given = [...(options.sectionBars ?? [])].filter((b) => b > 0 && b < this.bars);
    this.sections =
      given.length > 0
        ? [0, ...new Set(given.sort((a, b) => a - b))]
        : Array.from({ length: Math.ceil(this.bars / 8) }, (_, i) => i * 8);
  }

  /** Bars including the count-in. */
  get totalBars(): number {
    return this.bars + 1;
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
    if (this.chart)
      return this.chart[bar - 1]?.some((n) => n.kind === 'strike') ? 'player' : 'enemy';
    const { mode, since } = this.modeAt(bar);
    if (mode === 'free') return 'free';
    return (bar - 1 - since) % 4 < 2 ? 'enemy' : 'player';
  }

  /** The bar's notes. `enemyHp` (0–1) picks the enemy's phase. */
  plan(bar: number, enemyHp = 1): BarPlan {
    const turn = this.turnAt(bar);
    if (turn === 'count' || bar >= this.totalBars) return { bar, turn, notes: [] };
    if (this.chart) return this.chartPlan(bar, turn);
    const random = barRandom(this.options.seed, bar);
    if (turn === 'player') return { bar, turn, notes: this.strikes(bar, random) };
    const attack = turn === 'enemy' || random() < FREE_ATTACK[this.options.difficulty];
    if (!attack) return { bar, turn, notes: [] };
    const from = turn === 'enemy' ? 0 : Math.floor(this.options.beatsPerBar / 2);
    const { notes, first, cues } = this.attacks(bar, from, enemyHp, random);
    const plan: BarPlan = cues.length > 0 ? { bar, turn, notes, cues } : { bar, turn, notes };
    return first ? { ...plan, move: first } : plan;
  }

  /** A bar of a hand-made chart; bar 1 also starts the chart's own choreography. */
  private chartPlan(bar: number, turn: Turn): BarPlan {
    const { beatsPerBar, chart } = this.options;
    const start = bar * beatsPerBar;
    const notes = (this.chart?.[bar - 1] ?? []).map((n, i): ChartNote => {
      const a = i * 1.3;
      const strike = n.kind === 'strike';
      return {
        id: `${bar}:${i}`,
        beat: start + n.offset,
        kind: n.kind,
        power: n.power,
        x: n.x ?? (strike ? 0.2 + 0.6 * ((i % 4) / 3) : 0.5 + Math.cos(a) * 0.28),
        y: n.y ?? (strike ? 0.64 + (i % 2) * 0.1 : 0.32 + Math.sin(a) * 0.12),
      };
    });
    if (bar === 1 && chart)
      return { bar, turn, notes, cues: [{ beat: start, sequence: chart.id }] };
    return { bar, turn, notes };
  }

  /** Strike notes that land in a full fight played well, for sizing how hard each one hits. */
  expectedStrikes(): number {
    const steps = this.options.beatsPerBar / this.grid;
    if (this.chart) return Math.max(1, this.chart.flat().filter((n) => n.kind === 'strike').length);
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
  ): { notes: ChartNote[]; first?: EnemyMove; cues: { beat: number; sequence: string }[] } {
    const { beatsPerBar, difficulty, enemy } = this.options;
    const start = bar * beatsPerBar;
    const notes: ChartNote[] = [];
    const cues: { beat: number; sequence: string }[] = [];
    let first: EnemyMove | undefined;
    let cursor = from;
    // One walk around the ellipse per bar, so a new move never starts on top of the last note.
    let angle = random() * Math.PI * 2;
    while (cursor < beatsPerBar) {
      const room = beatsPerBar - cursor;
      const move = this.pickMove(enemy.moves, room, enemyHp, random);
      if (!move) break;
      first ??= move;
      const shape = this.shape(move);
      const kept = thinShape(shape.notes, this.secondsPerBeat, MIN_GAP[difficulty]);
      if (shape.sequence) cues.push({ beat: start + cursor, sequence: shape.sequence });
      angle += random() * 0.4;
      for (const note of kept) {
        const a = angle;
        angle += 1;
        notes.push({
          id: `${bar}:${notes.length}`,
          beat: start + cursor + note.offset,
          kind: note.kind,
          move: move.id,
          power: note.power,
          x: note.x ?? 0.5 + Math.cos(a) * 0.28,
          y: note.y ?? 0.32 + Math.sin(a) * 0.12,
        });
      }
      // Easy fights leave a beat to breathe between moves; free bars hold one move at most.
      cursor += shape.span + (difficulty === 'easy' ? 1 : 0);
      if (from > 0) break;
    }
    return first ? { notes, first, cues } : { notes, cues };
  }

  private pickMove(
    moves: readonly EnemyMove[],
    room: number,
    enemyHp: number,
    random: () => number,
  ): EnemyMove | undefined {
    const fitting = moves.filter((m) => this.shape(m).span <= room);
    if (fitting.length === 0) return undefined;
    // Below half HP the enemy favours moves with more notes: its second phase.
    const weight = (m: EnemyMove) => {
      const count = this.shape(m).notes.length;
      return enemyHp < 0.5 ? count : 1 + 1 / count;
    };
    const total = fitting.reduce((sum, m) => sum + weight(m), 0);
    let roll = random() * total;
    return fitting.find((m) => (roll -= weight(m)) < 0) ?? fitting.at(-1);
  }

  private shape(move: EnemyMove): MoveShape {
    return (
      this.shapes.get(move.id) ?? moveShape(move, this.options.sequences, this.options.beatsPerBar)
    );
  }
}
