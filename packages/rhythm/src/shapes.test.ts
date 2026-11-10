import type { EnemyDef, SequenceDef } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { FightDirector, type DirectorOptions } from './director.ts';
import { chartBars, moveShape } from './shapes.ts';

const lunge: SequenceDef = {
  id: 'lunge',
  kind: 'move',
  name: { en: 'Lunge' },
  length: 2,
  tracks: [
    {
      id: 'n',
      kind: 'notes',
      notes: [
        { id: 'a', at: 0, kind: 'parry' },
        { id: 'b', at: 0.75, kind: 'dodge', power: 2, x: 0.1, y: 0.2 },
        { id: 'c', at: 1.5, kind: 'strike' },
      ],
    },
    {
      id: 's',
      kind: 'stage',
      clips: [{ id: 'k', at: 0.75, action: 'stage.shake', params: { strength: 0.5 } }],
    },
  ],
};

const enemy: EnemyDef = {
  id: 'duelist',
  name: { en: 'Duelist' },
  moves: [{ id: 'm', name: { en: 'Lunge' }, pattern: 'jab', answer: 'parry', sequence: 'lunge' }],
};

const options = (over: Partial<DirectorOptions> = {}): DirectorOptions => ({
  enemy,
  mode: 'call',
  difficulty: 'normal',
  bars: 8,
  bpm: 100,
  beatsPerBar: 4,
  seed: 3,
  sequences: [lunge],
  ...over,
});

describe('move sequences', () => {
  it('replace the pattern with their own notes and length, leaving strikes out', () => {
    const shape = moveShape(enemy.moves[0] as EnemyDef['moves'][number], [lunge], 4);
    expect(shape).toEqual({
      notes: [
        { offset: 0, kind: 'parry', power: 1 },
        { offset: 0.75, kind: 'dodge', power: 2, x: 0.1, y: 0.2 },
      ],
      span: 2,
      sequence: 'lunge',
    });
  });

  it('fall back to the pattern when the sequence is missing or empty', () => {
    const move = {
      id: 'm',
      name: {},
      pattern: 'double',
      answer: 'dodge',
      sequence: 'gone',
    } as const;
    expect(moveShape(move, [lunge], 4)).toEqual({
      notes: [
        { offset: 0, kind: 'dodge', power: 1 },
        { offset: 0.5, kind: 'dodge', power: 1 },
      ],
      span: 1,
    });
  });

  it('play in the enemy bars and cue their choreography where each move starts', () => {
    const director = new FightDirector(options());
    const plan = director.plan(1);
    expect(plan.turn).toBe('enemy');
    expect(plan.notes.map((n) => [n.beat, n.kind])).toEqual([
      [4, 'parry'],
      [4.75, 'dodge'],
      [6, 'parry'],
      [6.75, 'dodge'],
    ]);
    expect(plan.notes[1]).toMatchObject({ x: 0.1, y: 0.2, power: 2 });
    expect(plan.cues).toEqual([
      { beat: 4, sequence: 'lunge' },
      { beat: 6, sequence: 'lunge' },
    ]);
  });
});

const chart: SequenceDef = {
  id: 'duel',
  kind: 'scene',
  name: { en: 'Duel' },
  length: 10,
  tracks: [
    {
      id: 'n',
      kind: 'notes',
      notes: [
        { id: 'a', at: 0, kind: 'parry' },
        { id: 'b', at: 2, kind: 'dodge' },
        { id: 'c', at: 4, kind: 'strike' },
        { id: 'd', at: 5.5, kind: 'strike' },
        { id: 'e', at: 9, kind: 'parry' },
        { id: 'f', at: 12, kind: 'parry' },
      ],
    },
  ],
};

describe('charts', () => {
  it('cut a chart into bars, dropping notes past its end', () => {
    expect(chartBars(chart, 4).map((bar) => bar.map((n) => n.offset))).toEqual([
      [0, 2],
      [0, 1.5],
      [1],
    ]);
  });

  it('become the whole fight: bars with strikes are the reader’s turn', () => {
    const director = new FightDirector(options({ chart, bars: 16 }));
    expect(director.totalBars).toBe(4);
    expect([1, 2, 3].map((b) => director.turnAt(b))).toEqual(['enemy', 'player', 'enemy']);
    expect(director.plan(2).notes.map((n) => [n.beat, n.kind])).toEqual([
      [8, 'strike'],
      [9.5, 'strike'],
    ]);
    expect(director.plan(1).cues).toEqual([{ beat: 4, sequence: 'duel' }]);
    expect(director.expectedStrikes()).toBe(2);
  });
});
