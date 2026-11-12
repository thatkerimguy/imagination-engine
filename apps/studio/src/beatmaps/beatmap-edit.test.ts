import { buildZip, SAMPLE_OSU, playRules, prepareObjects } from '@ie/rhythm';
import { analyzeProject, beatmapSchema, storyProjectSchema, type BeatmapDef } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { newProject } from '../project/factory.ts';
import {
  addBeatmaps,
  addObject,
  moveObjects,
  newBeatmap,
  putTiming,
  removeBeatmap,
  removeObjects,
  removeTiming,
  retimeObjects,
  setObject,
  shiftMap,
  stillValid,
  timingFromTrack,
  toggleCombo,
  updateBeatmap,
} from './beatmap-edit.ts';
import { readChartFiles } from './import-osu.ts';
import {
  copyObjects,
  hitTest,
  lengthInBeats,
  pasteObjects,
  sliderFromDraft,
  spinnerAt,
  stepTime,
  withLength,
} from './note-tools.ts';

const name = (n: string) => ({ en: n, tr: n });

function sample(): BeatmapDef {
  const map = newBeatmap(name('Test'));
  return {
    ...map,
    timing: [{ t: 0, bpm: 120 }],
    objects: [
      { id: 'a', kind: 'circle', t: 500, x: 0.2, y: 0.2 },
      { id: 'b', kind: 'circle', t: 1000, x: 0.8, y: 0.5 },
      {
        id: 'c',
        kind: 'slider',
        t: 1500,
        x: 0.5,
        y: 0.3,
        curve: 'line',
        path: [{ x: 0.9, y: 0.3 }],
        slides: 1,
        end: 2000,
      },
    ],
  };
}

describe('beatmap edits', () => {
  it('adds, updates and removes beatmaps, dropping the field when none are left', () => {
    const map = newBeatmap(name('One'));
    let doc = addBeatmaps(newProject(name('Story')), [map]);
    expect(doc.beatmaps).toHaveLength(1);
    doc = updateBeatmap(doc, map.id, (m) => ({ ...m, lead: 300 }));
    expect(doc.beatmaps?.[0]?.lead).toBe(300);
    expect(storyProjectSchema.safeParse(doc).success).toBe(true);
    doc = removeBeatmap(doc, map.id);
    expect('beatmaps' in doc).toBe(false);
  });

  it('keeps notes in time order and moves a selection without leaving the field', () => {
    let map = addObject(sample(), { id: 'd', kind: 'circle', t: 700, x: 0.5, y: 0.5 });
    expect(map.objects.map((o) => o.id)).toEqual(['a', 'd', 'b', 'c']);
    map = moveObjects(map, new Set(['b', 'c']), 0.5, 0);
    // The slider's path end sat at 0.9, so the whole selection only moves 0.1.
    const b = map.objects.find((o) => o.id === 'b');
    expect(b?.kind === 'circle' && b.x).toBeCloseTo(0.9);
    const c = map.objects.find((o) => o.id === 'c');
    expect(c?.kind === 'slider' && c.path[0]?.x).toBeCloseTo(1);
    expect(beatmapSchema.safeParse(map).success).toBe(true);
  });

  it('retimes a selection with its ends, keeping its spacing and stopping at zero', () => {
    // Asked for 600 ms back, the selection only goes 500: its first note stops at zero.
    const map = retimeObjects(sample(), new Set(['c', 'a']), -600);
    const c = map.objects.find((o) => o.id === 'c');
    expect(c?.t).toBe(1000);
    expect(c?.kind === 'slider' && c.end).toBe(1500);
    expect(map.objects.find((o) => o.id === 'a')?.t).toBe(0);
    expect(map.objects.map((o) => o.id)).toEqual(['a', 'b', 'c']);
    // A note already before zero (an imported chart) doesn't go further back.
    const early = addObject(sample(), { id: 'e', kind: 'circle', t: -200, x: 0.5, y: 0.5 });
    expect(retimeObjects(early, new Set(['e', 'a']), -100)).toBe(early);
  });

  it('moves a slider bent past the edge without jumping', () => {
    const bent = addObject(sample(), {
      id: 's',
      kind: 'slider',
      t: 3000,
      x: 0.1,
      y: 0.3,
      curve: 'bezier',
      path: [
        { x: -0.05, y: 0.4 },
        { x: 0.3, y: 0.5 },
      ],
      slides: 1,
      end: 3500,
    });
    const at = (m: BeatmapDef) => {
      const s = m.objects.find((o) => o.id === 's');
      return s?.kind === 'slider' ? { x: s.x, y: s.y, bend: s.path[0]?.x } : null;
    };
    const ids = new Set(['s']);
    expect(at(moveObjects(bent, ids, 0.01, 0))?.x).toBeCloseTo(0.11);
    // Further left would take the bend further off the field: it stays put.
    expect(at(moveObjects(bent, ids, -0.1, 0))?.x).toBeCloseTo(0.1);
    // A drag straight down moves nothing sideways.
    const down = at(moveObjects(bent, ids, 0, 0.1));
    expect(down?.x).toBeCloseTo(0.1);
    expect(down?.y).toBeCloseTo(0.4);
  });

  it('toggles new combos and removes notes', () => {
    let map = toggleCombo(sample(), new Set(['a', 'b']));
    expect(map.objects.filter((o) => o.combo)).toHaveLength(2);
    map = toggleCombo(map, new Set(['a', 'b']));
    expect(map.objects.some((o) => o.combo)).toBe(false);
    expect(removeObjects(map, new Set(['a'])).objects).toHaveLength(2);
  });

  it('keeps at least one tempo and replaces one at the same moment', () => {
    let map = putTiming(sample(), { t: 1000, bpm: 150 });
    map = putTiming(map, { t: 1000, bpm: 140, meter: 3 });
    expect(map.timing).toEqual([{ t: 0, bpm: 120 }, { t: 1000, bpm: 140, meter: 3 }]);
    map = removeTiming(removeTiming(map, 0), 1000);
    expect(map.timing).toHaveLength(1);
  });

  it('shifts the whole chart, tempos exactly as far as the notes', () => {
    const map = shiftMap(sample(), 25);
    expect(map.timing[0]?.t).toBe(25);
    expect(map.objects.map((o) => o.t)).toEqual([525, 1025, 1525]);
    // Near zero the notes can only go 3 ms back, and so does the grid under them.
    const near = shiftMap(retimeObjects(sample(), new Set(['a', 'b', 'c']), -497), -10);
    expect(near.objects.map((o) => o.t)).toEqual([0, 500, 1000]);
    expect(near.timing[0]?.t).toBe(-3);
  });

  it('drops an edit that would break the schema', () => {
    const map = sample();
    const doc = addBeatmaps(newProject(name('Story')), [map]);
    const late = updateBeatmap(doc, map.id, (m) =>
      setObject(m, 'a', (o) => ({ ...o, t: 4_000_000 })),
    );
    expect(late).toBe(doc);
    const long = updateBeatmap(doc, map.id, (m) => ({ ...m, credit: { title: 'x'.repeat(201) } }));
    expect(long).toBe(doc);
    expect(stillValid(map, { ...map, lead: 100 })).toBe(true);
  });

  it('takes a tempo from a calibrated or analysed track', () => {
    expect(timingFromTrack(undefined)).toBeNull();
    const track = {
      id: 't1',
      title: 'Song',
      source: { kind: 'url' as const, url: 'https://example.com/a.mp3' },
      calibration: { bpm: 128, offset: 0.25, beatsPerBar: 3 },
    };
    expect(timingFromTrack(track)).toEqual({ t: 250, bpm: 128, meter: 3 });
  });
});

describe('note tools', () => {
  const timing = [{ t: 0, bpm: 120 }];

  it('steps along the grid and lands on it first when off it', () => {
    expect(stepTime(timing, 0, 4, 1)).toBe(125);
    expect(stepTime(timing, 130, 4, 1)).toBe(250);
    expect(stepTime(timing, 260, 4, -1)).toBe(250);
    expect(stepTime(timing, 0, 4, -1)).toBe(0);
  });

  it('turns a drawn slider into a note whose length fits the grid', () => {
    expect(sliderFromDraft({ t: 0, points: [{ x: 0.1, y: 0.1 }] }, timing, 4, 'n1')).toBeNull();
    const slider = sliderFromDraft(
      { t: 1000, points: [{ x: 0.1, y: 0.1 }, { x: 0.37, y: 0.1 }] },
      timing,
      4,
      'n1',
    );
    expect(slider?.curve).toBe('line');
    // 0.27 field widths at 0.27 per beat: one beat, 500 ms.
    expect(slider?.end).toBe(1500);
    const curved = sliderFromDraft(
      { t: 0, points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }, { x: 0.7, y: 0.1 }] },
      timing,
      4,
      'n2',
    );
    expect(curved?.curve).toBe('bezier');
  });

  it('makes a spinner a bar long and changes lengths in beats', () => {
    const spinner = spinnerAt([{ t: 0, bpm: 120, meter: 3 }], 1000, 's');
    expect(spinner.end).toBe(2500);
    expect(lengthInBeats(spinner, timing)).toBe(3);
    expect(withLength(spinner, 2, timing).end).toBe(2000);
  });

  it('copies notes and pastes them at the playhead with new IDs', () => {
    const map = sample();
    const clip = copyObjects(map.objects, new Set(['b', 'c']));
    expect(clip).not.toBeNull();
    let n = 0;
    const pasted = pasteObjects(clip!, 4000, () => `p${++n}`);
    expect(pasted.map((o) => [o.id, o.t])).toEqual([
      ['p1', 4000],
      ['p2', 4500],
    ]);
    expect(pasted[1]?.kind === 'slider' && pasted[1].end).toBe(5000);
    expect(copyObjects(map.objects, new Set())).toBeNull();
  });

  it('finds the note under the pointer, the one nearest the playhead first', () => {
    const map = addObject(sample(), { id: 'e', kind: 'circle', t: 1100, x: 0.8, y: 0.5 });
    const rules = playRules(map.difficulty);
    const objects = prepareObjects(map, rules);
    expect(hitTest(objects, 1080, rules, 0.8, 0.5)?.source.id).toBe('e');
    expect(hitTest(objects, 1000, rules, 0.81, 0.5)?.source.id).toBe('b');
    // Along the slider's body, not only its head.
    expect(hitTest(objects, 1500, rules, 0.85, 0.3)?.source.id).toBe('c');
    expect(hitTest(objects, 1000, rules, 0.05, 0.7)).toBeNull();
  });
});

describe('chart import', () => {
  it('reads an .osu file and pairs it with the song picked beside it', async () => {
    const chart = new File([SAMPLE_OSU], 'Lantern Steps (Easy).osu');
    const song = new File([new Uint8Array(8)], 'song.mp3', { type: 'audio/mpeg' });
    const set = await readChartFiles([chart, song]);
    expect(set.charts).toHaveLength(1);
    expect(set.charts[0]?.audio?.name).toBe('song.mp3');
    expect(set.song).toBeNull();
    expect(set.skipped).toBe(0);
    const doc = addBeatmaps(
      newProject(name('Story')),
      set.charts.map((c) => c.chart.beatmap),
    );
    expect(storyProjectSchema.safeParse(doc).success).toBe(true);
    // No song in the library yet: only the missing-track warning, no errors.
    const problems = analyzeProject(doc).problems.filter((p) => p.code.startsWith('beatmap'));
    expect(problems.every((p) => p.severity !== 'error' || p.code === 'beatmap-track')).toBe(true);
  });

  it('gives each archive\'s charts that archive\'s song', async () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    const archive = (song: string, bytes: number) => {
      const chart = encode(SAMPLE_OSU.replace('AudioFilename: song.mp3', `AudioFilename: ${song}`));
      const audio = new Uint8Array(bytes);
      return new File(
        [
          buildZip([
            { name: 'easy.osu', data: chart, method: 0, size: chart.length },
            { name: 'hard.osu', data: chart, method: 0, size: chart.length },
            { name: 'normal-hitclap.wav', data: new Uint8Array(4), method: 0, size: 4 },
            { name: song, data: audio, method: 0, size: audio.length },
          ]),
        ],
        `${song}.osz`,
      );
    };
    const set = await readChartFiles([archive('first.mp3', 8), archive('second.ogg', 16)]);
    expect(set.charts.map((c) => c.audio?.name)).toEqual([
      'first.mp3',
      'first.mp3',
      'second.ogg',
      'second.ogg',
    ]);
    // One File per song, so it is stored once for both of its charts.
    expect(set.charts[0]?.audio).toBe(set.charts[1]?.audio);
    expect(set.charts[2]?.audio?.size).toBe(16);
  });

  it('picks a song on its own for a new beatmap', async () => {
    const song = new File([new Uint8Array(8)], 'tune.ogg', { type: 'audio/ogg' });
    const set = await readChartFiles([song]);
    expect(set.charts).toHaveLength(0);
    expect(set.song?.name).toBe('tune.ogg');
  });

  it('counts charts it cannot read', async () => {
    const set = await readChartFiles([new File(['not a chart'], 'broken.osu')]);
    expect(set.charts).toHaveLength(0);
    expect(set.skipped).toBe(1);
  });
});
