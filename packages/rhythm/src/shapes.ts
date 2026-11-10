import { sequenceNotes, type EnemyMove, type SequenceDef } from '@ie/story';
import { PATTERNS } from './density.ts';

export type NoteKind = 'strike' | 'parry' | 'dodge';

/** One note of a move, in beats from where the move starts. */
export interface ShapeNote {
  readonly offset: number;
  readonly kind: NoteKind;
  readonly power: number;
  readonly x?: number;
  readonly y?: number;
}

/** Where a move's notes fall and how many beats it takes. */
export interface MoveShape {
  readonly notes: readonly ShapeNote[];
  readonly span: number;
  /** The move sequence whose choreography plays with it (ADR 0019). */
  readonly sequence?: string;
}

/**
 * A move's shape: its move sequence's notes when it names one (ADR 0019), else its pattern
 * preset (ADR 0016). A move never runs past a bar, so its notes stay inside the bar it starts.
 */
export function moveShape(
  move: EnemyMove,
  sequences: readonly SequenceDef[] | undefined,
  beatsPerBar: number,
): MoveShape {
  const sequence = move.sequence
    ? sequences?.find((s) => s.id === move.sequence && s.kind === 'move')
    : undefined;
  if (sequence) {
    const span = Math.min(sequence.length, beatsPerBar);
    const notes = sequenceNotes(sequence)
      .filter((n) => n.kind !== 'strike' && n.at < span)
      .map((n): ShapeNote => ({
        offset: n.at,
        kind: n.kind,
        power: n.power ?? move.power ?? 1,
        ...(n.x === undefined ? {} : { x: n.x }),
        ...(n.y === undefined ? {} : { y: n.y }),
      }));
    if (notes.length > 0) return { notes, span, sequence: sequence.id };
  }
  const pattern = PATTERNS[move.pattern];
  return {
    notes: pattern.offsets.map((offset) => ({
      offset,
      kind: move.answer,
      power: move.power ?? 1,
    })),
    span: pattern.span,
  };
}

/** Drops notes closer than `minGap` seconds to the one kept before them. */
export function thinShape(
  notes: readonly ShapeNote[],
  secondsPerBeat: number,
  minGap: number,
): ShapeNote[] {
  const kept: ShapeNote[] = [];
  for (const note of notes) {
    const last = kept.at(-1);
    if (!last || (note.offset - last.offset) * secondsPerBeat >= minGap - 1e-9) kept.push(note);
  }
  return kept;
}

/**
 * A hand-made chart (a scene sequence's notes) cut into fight bars: index 0 is the first bar
 * after the count-in. Offsets are beats from the start of their bar.
 */
export function chartBars(chart: SequenceDef, beatsPerBar: number): ShapeNote[][] {
  const bars: ShapeNote[][] = Array.from(
    { length: Math.max(1, Math.ceil(chart.length / beatsPerBar)) },
    () => [],
  );
  for (const n of sequenceNotes(chart)) {
    if (n.at >= chart.length) continue;
    const bar = Math.floor(n.at / beatsPerBar);
    bars[bar]?.push({
      offset: n.at - bar * beatsPerBar,
      kind: n.kind,
      power: n.power ?? 1,
      ...(n.x === undefined ? {} : { x: n.x }),
      ...(n.y === undefined ? {} : { y: n.y }),
    });
  }
  return bars;
}
