import { beatmapSchema, type BeatmapDef } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { naturalLength, pointAt, samplePath } from './curve.ts';
import { buildZip, SAMPLE_OSU } from './fixture.ts';
import { OsuError, parseOsu } from './osu.ts';
import { writeOsu } from './osu-write.ts';
import { playRules, rankFor } from './rules.ts';
import { gridLines, snapTime } from './timing.ts';
import { readZip } from './zip.ts';

function ids(): () => string {
  let n = 0;
  return () => `o${++n}`;
}

const chart = (): BeatmapDef => parseOsu(SAMPLE_OSU, ids(), 'map1').beatmap;

describe('.osu charts', () => {
  it('reads timing, difficulty, credits and every kind of note', () => {
    const { beatmap, audioFile, preview } = parseOsu(SAMPLE_OSU, ids(), 'map1');
    expect(beatmapSchema.safeParse(beatmap).success).toBe(true);
    expect(audioFile).toBe('song.mp3');
    expect(preview).toBe(1000);
    expect(beatmap.name.en).toBe('Lantern Steps · Easy');
    expect(beatmap.lead).toBe(500);
    expect(beatmap.timing).toEqual([{ t: 1000, bpm: 120 }]);
    expect(beatmap.difficulty).toEqual({ size: 4, approach: 6, accuracy: 5, drain: 4 });
    expect(beatmap.credit).toMatchObject({ artist: 'Nobody', mapper: 'Tester' });
    expect(beatmap.objects.map((o) => o.kind)).toEqual([
      'circle',
      'circle',
      'slider',
      'slider',
      'spinner',
      'circle',
    ]);
    const [first, second, line, curve, spinner] = beatmap.objects;
    expect(first).toMatchObject({ t: 1000, x: 0.5, y: 0.375, combo: true });
    expect(second?.combo).toBeUndefined();
    // 140 units at speed 1 and 500 ms beats take one beat.
    expect(line).toMatchObject({ curve: 'line', end: 2500, slides: 1 });
    // After the speed change to 2, a crossing takes half a beat; it crosses twice.
    expect(curve).toMatchObject({ curve: 'bezier', end: 3500, slides: 2, combo: true });
    expect(spinner).toMatchObject({ t: 5000, end: 7000 });
  });

  it('keeps trick tempos out of the grid and far points within the margin', () => {
    const text = SAMPLE_OSU.replace(
      '3000,-50,4,2,0,60,0,0',
      '3000,-50,4,2,0,60,0,0\n4000,0.5,4,2,0,60,1,0\n4500,500,4,2,0,60,1,0',
    ).replace('L|240:100,1,140', 'L|-900:100,1,140');
    const map = parseOsu(text, ids(), 'm').beatmap;
    // A 0.5 ms beat (120000 BPM) is a trick: the grid keeps the tempo around it.
    expect(map.timing).toEqual([
      { t: 1000, bpm: 120 },
      { t: 4500, bpm: 120 },
    ]);
    const line = map.objects.find((o) => o.kind === 'slider' && o.curve === 'line');
    expect(line?.kind === 'slider' && line.path[0]?.x).toBe(-0.5);
    expect(beatmapSchema.safeParse(map).success).toBe(true);
  });

  it('refuses charts for other modes and files that are not charts', () => {
    expect(() => parseOsu(SAMPLE_OSU.replace('Mode: 0', 'Mode: 3'), ids(), 'm')).toThrow(OsuError);
    expect(() => parseOsu('hello', ids(), 'm')).toThrow(OsuError);
  });

  it('writes a chart that reads back the same', () => {
    const map = chart();
    const again = parseOsu(writeOsu(map, 'song.mp3'), ids(), 'map1').beatmap;
    expect(again.timing).toEqual(map.timing);
    expect(again.difficulty).toEqual(map.difficulty);
    expect(again.objects.length).toBe(map.objects.length);
    for (let i = 0; i < map.objects.length; i++) {
      const a = map.objects[i];
      const b = again.objects[i];
      expect(b?.kind).toBe(a?.kind);
      expect(b?.t).toBe(a?.t);
      if (a?.kind !== 'circle' && b?.kind !== 'circle')
        expect(Math.abs((b?.end ?? 0) - (a?.end ?? 0))).toBeLessThanOrEqual(1);
    }
  });
});

describe('slider paths', () => {
  it('measures straight lines, cuts them and carries them on', () => {
    const head = { x: 0, y: 0 };
    expect(naturalLength(head, 'line', [{ x: 0.3, y: 0.4 }])).toBeCloseTo(0.5, 5);
    const cut = samplePath(head, 'line', [{ x: 1, y: 0 }], 0.25);
    expect(cut.length).toBeCloseTo(0.25, 5);
    expect(pointAt(cut, 10).x).toBeCloseTo(0.25, 5);
    const longer = samplePath(head, 'line', [{ x: 0.1, y: 0 }], 0.3);
    expect(pointAt(longer, 0.3).x).toBeCloseTo(0.3, 5);
  });

  it('follows an arc through its middle point', () => {
    const path = samplePath({ x: 0, y: 0 }, 'arc', [
      { x: 0.5, y: 0.5 },
      { x: 1, y: 0 },
    ]);
    // Half a circle of radius 0.5.
    expect(path.length).toBeCloseTo(Math.PI * 0.5, 2);
    const mid = pointAt(path, path.length / 2);
    expect(mid.x).toBeCloseTo(0.5, 2);
    expect(Math.abs(mid.y)).toBeCloseTo(0.5, 2);
  });

  it('breaks a bezier at a repeated point', () => {
    const corner = samplePath({ x: 0, y: 0 }, 'bezier', [
      { x: 0.5, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0.5, y: 0.5 },
    ]);
    expect(corner.length).toBeCloseTo(1, 3);
  });
});

describe('timing grid', () => {
  const timing = [
    { t: 1000, bpm: 120 },
    { t: 5000, bpm: 60, meter: 3 },
  ];
  it('snaps to the beat divisions of the tempo in force', () => {
    expect(snapTime(timing, 1240, 2)).toBe(1250);
    expect(snapTime(timing, 1240, 4)).toBe(1250);
    expect(snapTime(timing, 1130, 4)).toBe(1125);
    expect(snapTime(timing, 4990, 1)).toBe(5000);
    expect(snapTime(timing, 6400, 1)).toBe(6000);
  });

  it('marks bars and beats', () => {
    const lines = gridLines(timing, 1000, 3000, 2);
    expect(lines[0]).toEqual({ t: 1000, strength: 'bar' });
    expect(lines[1]).toEqual({ t: 1250, strength: 'sub' });
    expect(lines[2]).toEqual({ t: 1500, strength: 'beat' });
    expect(lines.find((l) => l.t === 3000)?.strength).toBe('bar');
    const waltz = gridLines(timing, 5000, 8000, 1);
    expect(waltz.map((l) => l.strength)).toEqual(['bar', 'beat', 'beat', 'bar']);
  });
});

describe('rules', () => {
  it('turns dials into sizes, windows and approach times', () => {
    const r = playRules({ size: 4, approach: 5, accuracy: 5, drain: 5 });
    expect(r.preempt).toBe(1200);
    expect(r.windows).toEqual({ perfect: 50, great: 100, good: 150 });
    expect(r.radius * 512).toBeCloseTo(36.48, 2);
    expect(playRules({ size: 4, approach: 10, accuracy: 5, drain: 5 }).preempt).toBe(450);
    const easy = playRules({ size: 4, approach: 10, accuracy: 10, drain: 10 }, ['easy', 'slow']);
    expect(easy.preempt).toBe(1200);
    expect(easy.rate).toBe(0.75);
  });

  it('ranks plays', () => {
    expect(rankFor(1, 0)).toBe('S+');
    expect(rankFor(0.96, 0)).toBe('S');
    expect(rankFor(0.96, 1)).toBe('A');
    expect(rankFor(0.5, 9)).toBe('D');
  });
});

describe('chart archives', () => {
  it('reads stored and deflated entries', async () => {
    const text = new TextEncoder().encode('hello chart');
    const deflated = new Uint8Array(
      await new Response(
        new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw')),
      ).arrayBuffer(),
    );
    const zip = buildZip([
      { name: 'a.osu', data: text, method: 0, size: text.length },
      { name: 'b/c.osu', data: deflated, method: 8, size: text.length },
    ]);
    const entries = readZip(zip);
    expect(entries.map((e) => e.name)).toEqual(['a.osu', 'b/c.osu']);
    for (const entry of entries)
      expect(new TextDecoder().decode(await entry.read())).toBe('hello chart');
  });
});
