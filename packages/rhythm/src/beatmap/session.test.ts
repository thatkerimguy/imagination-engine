import type { BeatmapDef } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { playRules, type Mod } from './rules.ts';
import { BeatmapSession } from './session.ts';

const difficulty = { size: 4, approach: 5, accuracy: 5, drain: 5 };

function map(objects: BeatmapDef['objects']): BeatmapDef {
  return { id: 'm', name: { en: 'Test' }, difficulty, timing: [{ t: 0, bpm: 120 }], objects };
}

function session(objects: BeatmapDef['objects'], mods: Mod[] = []): BeatmapSession {
  return new BeatmapSession(map(objects), playRules(difficulty, mods));
}

/** Runs the clock from `from` to `to` in 16 ms frames. */
function run(s: BeatmapSession, from: number, to: number, each?: (t: number) => void): void {
  for (let t = from; t <= to; t += 16) {
    each?.(t);
    s.update(t);
  }
}

describe('beatmap session', () => {
  it('judges a tap by how far off it is, and only on the circle', () => {
    const s = session([
      { id: 'a', kind: 'circle', t: 1000, x: 0.5, y: 0.375 },
      { id: 'b', kind: 'circle', t: 1500, x: 0.2, y: 0.2 },
    ]);
    s.update(990);
    expect(s.press(1010, 0.9, 0.1)).toBe('none');
    expect(s.press(1010, 0.5, 0.375)).toBe('hit');
    s.release();
    s.update(1460);
    expect(s.press(1580, 0.2, 0.2)).toBe('hit');
    const judged = s.takeEvents().filter((e) => e.kind === 'judged');
    expect(judged.map((e) => (e.kind === 'judged' ? e.judgement : ''))).toEqual([
      'perfect',
      'great',
    ]);
    expect(s.offsets).toEqual([10, 80]);
    expect(s.stats.combo).toBe(2);
  });

  it('only hits the earliest note waiting', () => {
    const s = session([
      { id: 'a', kind: 'circle', t: 1000, x: 0.2, y: 0.2 },
      { id: 'b', kind: 'circle', t: 1050, x: 0.8, y: 0.2 },
    ]);
    s.update(1000);
    expect(s.press(1040, 0.8, 0.2)).toBe('none');
    expect(s.press(1040, 0.2, 0.2)).toBe('hit');
  });

  it('misses a note nobody tapped and breaks the combo', () => {
    const s = session([
      { id: 'a', kind: 'circle', t: 500, x: 0.5, y: 0.375 },
      { id: 'b', kind: 'circle', t: 1000, x: 0.5, y: 0.375 },
    ]);
    s.press(500);
    s.release();
    run(s, 500, 1400);
    expect(s.stats.counts).toMatchObject({ perfect: 1, miss: 1 });
    expect(s.stats.combo).toBe(0);
    expect(s.finished).toBe(true);
    expect(s.result().accuracy).toBeCloseTo(0.5, 5);
  });

  it('scores a slider by the head, ticks and end the cursor followed', () => {
    const slider = {
      id: 's',
      kind: 'slider' as const,
      t: 1000,
      x: 0.2,
      y: 0.3,
      curve: 'line' as const,
      path: [{ x: 0.6, y: 0.3 }],
      slides: 1,
      end: 2000,
    };
    const followed = session([slider]);
    followed.update(1000);
    followed.press(1000, 0.2, 0.3);
    run(followed, 1000, 2100, (t) => {
      const f = Math.min(1, (t - 1000) / 1000);
      followed.move(0.2 + 0.4 * f, 0.3);
    });
    expect(followed.stats.counts.perfect).toBe(1);
    // Head, the tick at 1500, and the end.
    expect(followed.stats.maxCombo).toBe(3);

    const dropped = session([slider]);
    dropped.update(1000);
    dropped.press(1000, 0.2, 0.3);
    dropped.release();
    run(dropped, 1000, 2100);
    expect(dropped.stats.counts.good).toBe(1);
  });

  it('counts spins and judges a spinner by them', () => {
    const s = session([{ id: 'p', kind: 'spinner', t: 0, end: 2000 }]);
    s.press(0, 0.6, 0.375);
    run(s, 0, 2100, (t) => {
      const a = (t / 1000) * Math.PI * 2 * 4;
      s.move(0.5 + Math.cos(a) * 0.1, 0.375 + Math.sin(a) * 0.1);
    });
    expect(s.stats.counts.perfect).toBe(1);
  });

  it('plays itself perfectly on auto', () => {
    const s = session(
      [
        { id: 'a', kind: 'circle', t: 500, x: 0.1, y: 0.1, combo: true },
        {
          id: 's',
          kind: 'slider',
          t: 1000,
          x: 0.2,
          y: 0.3,
          curve: 'bezier',
          path: [
            { x: 0.4, y: 0.1 },
            { x: 0.6, y: 0.3 },
          ],
          slides: 2,
          end: 2000,
        },
        { id: 'p', kind: 'spinner', t: 2500, end: 4500 },
        { id: 'b', kind: 'circle', t: 5000, x: 0.9, y: 0.6 },
      ],
      ['auto'],
    );
    run(s, 0, 5200);
    expect(s.finished).toBe(true);
    expect(s.result().rank).toBe('S+');
    expect(s.result().meanOffset).toBe(0);
  });

  it('fails when health runs out, unless failing is off', () => {
    const notes = Array.from({ length: 30 }, (_, i) => ({
      id: `n${i}`,
      kind: 'circle' as const,
      t: 500 + i * 250,
      x: 0.5,
      y: 0.375,
    }));
    const s = session(notes);
    run(s, 0, 9000);
    expect(s.failed).toBe(true);
    expect(s.result().won).toBe(false);
    const kept = session(notes, ['noFail']);
    run(kept, 0, 9000);
    expect(kept.failed).toBe(false);
    expect(kept.finished).toBe(true);
  });
});

describe('beatmap settings', () => {
  it('keeps only valid stored settings', async () => {
    const { parsePrefs, DEFAULT_PREFS } = await import('./view/beatmap-menus.ts');
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('not json')).toEqual(DEFAULT_PREFS);
    expect(
      parsePrefs(JSON.stringify({ offset: 999, dim: 0.5, hitSounds: false, mods: ['easy', 'hard', 'x'] })),
    ).toEqual({ offset: 300, dim: 0.5, hitSounds: false, mods: ['easy'] });
  });
});
