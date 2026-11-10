import type { EnemyDef } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { DENSITY, FILL, MIN_GAP, pickSubdivision, thin } from './density.ts';
import { FightDirector, type DirectorOptions } from './director.ts';
import { FightSession, type FightClock, type FightEvent } from './fight.ts';
import { gradeFor } from './judge.ts';

const enemy: EnemyDef = {
  id: 'stranger',
  name: { en: 'The Stranger' },
  moves: [
    { id: 'cut', name: { en: 'Cut' }, pattern: 'jab', answer: 'parry' },
    { id: 'rush', name: { en: 'Rush' }, pattern: 'flurry', answer: 'parry' },
    { id: 'sweep', name: { en: 'Sweep' }, pattern: 'sweep', answer: 'dodge' },
  ],
};

const options = (over: Partial<DirectorOptions> = {}): DirectorOptions => ({
  enemy,
  mode: 'call',
  difficulty: 'normal',
  bars: 16,
  bpm: 120,
  beatsPerBar: 4,
  seed: 7,
  ...over,
});

/** A steady clock: 120 BPM, beat 0 at one second. */
const clock = (bpm = 120): FightClock => ({
  timeAt: (beat) => 1 + (beat * 60) / bpm,
  beatAt: (time) => ((time - 1) * bpm) / 60,
});

describe('density', () => {
  it('keeps strike rates inside each difficulty band across tempos', () => {
    for (const bpm of [70, 100, 128, 150, 174])
      for (const difficulty of ['easy', 'normal', 'hard'] as const) {
        const rate = (bpm / 60 / pickSubdivision(bpm, difficulty)) * FILL;
        expect(rate).toBeLessThanOrEqual(DENSITY[difficulty][1]);
      }
    expect(pickSubdivision(100, 'easy')).toBe(1);
    expect(pickSubdivision(100, 'normal')).toBe(0.5);
    expect(pickSubdivision(100, 'hard')).toBe(0.25);
  });

  it('thins notes that are closer than the minimum gap', () => {
    // At 100 BPM a sixteenth is 150 ms: too fast for easy, fine for hard.
    expect(thin([0, 0.25, 0.5, 0.75], 0.6, MIN_GAP.easy)).toEqual([0, 0.5]);
    expect(thin([0, 0.25, 0.5, 0.75], 0.6, MIN_GAP.hard)).toEqual([0, 0.25, 0.5, 0.75]);
  });
});

describe('judge', () => {
  it('grades by the PLAN windows and widens with the assist', () => {
    expect(gradeFor(0.02)).toBe('perfect');
    expect(gradeFor(-0.06)).toBe('great');
    expect(gradeFor(0.1)).toBe('good');
    expect(gradeFor(0.15)).toBeNull();
    expect(gradeFor(0.15, 1.6)).toBe('good');
  });
});

describe('fight director', () => {
  it('counts in, then alternates two enemy bars and two reader bars', () => {
    const d = new FightDirector(options());
    expect([0, 1, 2, 3, 4, 5, 6].map((b) => d.turnAt(b))).toEqual([
      'count',
      'enemy',
      'enemy',
      'player',
      'player',
      'enemy',
      'enemy',
    ]);
    expect(d.plan(0).notes).toEqual([]);
    expect(d.plan(3).notes.every((n) => n.kind === 'strike')).toBe(true);
    expect(d.plan(1).notes.every((n) => n.kind !== 'strike')).toBe(true);
  });

  it('is reproducible from its seed and differs between seeds', () => {
    const a = new FightDirector(options()).plan(3);
    const b = new FightDirector(options()).plan(3);
    const c = new FightDirector(options({ seed: 8 })).plan(1);
    expect(a).toEqual(b);
    expect(JSON.stringify(c)).not.toEqual(JSON.stringify(new FightDirector(options()).plan(1)));
  });

  it('keeps every note inside its bar', () => {
    const d = new FightDirector(options({ difficulty: 'hard' }));
    for (let bar = 1; bar < d.totalBars; bar++)
      for (const note of d.plan(bar, 0.3).notes) {
        expect(note.beat).toBeGreaterThanOrEqual(bar * 4);
        expect(note.beat).toBeLessThan((bar + 1) * 4);
      }
  });

  it('mixes modes at section starts', () => {
    const d = new FightDirector(options({ mode: 'mixed', sectionBars: [4, 8] }));
    expect(d.turnAt(1)).toBe('enemy');
    expect(d.turnAt(5)).toBe('free');
    expect(d.turnAt(9)).toBe('enemy');
    expect(new FightDirector(options({ mode: 'free' })).turnAt(3)).toBe('free');
  });

  it('never stacks one attack note on the next', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const d = new FightDirector(options({ seed, difficulty: 'hard' }));
      for (let bar = 1; bar < d.totalBars; bar++) {
        const notes = d.plan(bar, 0.3).notes.filter((n) => n.kind !== 'strike');
        for (let i = 1; i < notes.length; i++) {
          const [a, b] = [notes[i - 1], notes[i]];
          if (!a || !b) continue;
          // At least a twelfth of the frame apart (measured in a square frame).
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1 / 12);
        }
      }
    }
  });
});

/** Plays a whole fight at 60 frames a second, tapping or swiping with `react`. */
function play(
  session: FightSession,
  react: (time: number) => ('tap' | 'swipe')[] = () => [],
): FightEvent[] {
  const events: FightEvent[] = [];
  for (let time = 0; time < 120 && !session.done; time += 1 / 60) {
    events.push(...session.update(time));
    for (const action of react(time)) events.push(...session.input(action, time));
  }
  return events;
}

describe('fight session', () => {
  it('auto-play wins with a perfect score', () => {
    const session = new FightSession({ ...options(), clock: clock(), assist: { auto: true } });
    const events = play(session);
    expect(session.result).toEqual({ won: true, score: 100 });
    expect(session.counts.miss).toBe(0);
    expect(events.some((e) => e.type === 'phase')).toBe(true);
  });

  it('doing nothing loses: attacks land and strikes are missed', () => {
    const session = new FightSession({ ...options(), clock: clock() });
    play(session);
    expect(session.result?.won).toBe(false);
    expect(session.playerHp).toBe(0);
    expect(session.result?.score).toBe(0);
  });

  it('no-fail keeps the reader standing and counts as a win', () => {
    const session = new FightSession({ ...options(), clock: clock(), assist: { noFail: true } });
    play(session);
    expect(session.playerHp).toBe(1);
    expect(session.result?.won).toBe(true);
  });

  it('answering each note on time wins; the right input matters', () => {
    const session = new FightSession({ ...options(), clock: clock() });
    const answered = new Set<string>();
    play(session, (time) => {
      const due = session.notes.find((n) => !n.grade && !answered.has(n.id) && n.time <= time);
      if (!due) return [];
      answered.add(due.id);
      return [due.kind === 'dodge' ? 'swipe' : 'tap'];
    });
    expect(session.result?.won).toBe(true);
    expect(session.counts.miss).toBe(0);
    expect(session.score).toBeGreaterThan(95);

    const wrong = new FightSession({ ...options({ seed: 3 }), clock: clock() });
    play(wrong, (time) => {
      const due = wrong.notes.find((n) => !n.grade && n.time <= time);
      return due?.kind === 'dodge' ? ['tap'] : [];
    });
    expect(wrong.counts.miss).toBeGreaterThan(0);
  });

  it('free beat scores on-grid taps once per step and breaks the combo off the grid', () => {
    const session = new FightSession({ ...options({ mode: 'free', bars: 4 }), clock: clock() });
    session.update(0);
    // Bar 1 starts at beat 4 = 3 s; the normal grid at 120 BPM is an eighth (0.25 s).
    const onGrid = session.input('tap', 3.5 + 0.01);
    expect(onGrid[0]).toMatchObject({ type: 'judged', note: null, grade: 'perfect' });
    expect(session.input('tap', 3.5 + 0.02)).toEqual([]);
    const off = session.input('tap', 3.5 + 0.125);
    expect(off[0]).toMatchObject({ grade: 'miss' });
    expect(session.combo).toBe(0);
  });
});
