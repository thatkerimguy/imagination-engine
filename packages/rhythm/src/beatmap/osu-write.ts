import type { BeatmapDef, HitObject, SliderCurve } from '@ie/story';
import { naturalLength } from './curve.ts';
import { timingAt } from './timing.ts';

/*
 * Writes a BeatmapDef back out as an .osu chart (format v14), so a chart edited here opens in the
 * game it came from. Our sliders store when they end; that format stores how fast they move, so
 * each slider gets the speed change that makes it end on time.
 */

const UNITS = 512;
const MULTIPLIER = 1.4;
const CURVE_LETTER: Readonly<Record<SliderCurve, string>> = {
  bezier: 'B',
  line: 'L',
  arc: 'P',
  smooth: 'C',
};

const px = (n: number) => Math.round(n * UNITS);
const clean = (s: string | undefined) => (s ?? '').replace(/[\r\n]/g, ' ');

interface Line {
  readonly t: number;
  readonly text: string;
  /** Tempo lines sort before speed lines at the same moment. */
  readonly order: number;
}

function sliderSpeed(map: BeatmapDef, o: Extract<HitObject, { kind: 'slider' }>): number {
  const beat = 60_000 / timingAt(map.timing, o.t).bpm;
  const length = (o.length ?? naturalLength(o, o.curve, o.path)) * UNITS;
  const span = Math.max(1, (o.end - o.t) / o.slides);
  return (length / (MULTIPLIER * 100)) * (beat / span);
}

function objectLine(o: HitObject, first: boolean, map: BeatmapDef): string {
  const combo = first || o.combo ? 4 : 0;
  if (o.kind === 'circle') return `${px(o.x)},${px(o.y)},${Math.round(o.t)},${1 | combo},0,0:0:0:0:`;
  if (o.kind === 'spinner')
    return `256,192,${Math.round(o.t)},${8 | combo},0,${Math.round(o.end)},0:0:0:0:`;
  const speed = Math.max(0.1, Math.min(10, sliderSpeed(map, o)));
  const beat = 60_000 / timingAt(map.timing, o.t).bpm;
  const span = Math.max(1, (o.end - o.t) / o.slides);
  // A clamped speed changes the length instead, so the slider still ends on time.
  const length = ((MULTIPLIER * 100 * speed) / beat) * span;
  const points = o.path.map((p) => `${px(p.x)}:${px(p.y)}`).join('|');
  return `${px(o.x)},${px(o.y)},${Math.round(o.t)},${2 | combo},0,${CURVE_LETTER[o.curve]}|${points},${o.slides},${Math.round(length * 100) / 100}`;
}

export function writeOsu(map: BeatmapDef, audioFile: string): string {
  const name = map.name.en || map.name.tr || map.id;
  const credit = map.credit ?? {};
  const timing: Line[] = map.timing.map((p) => ({
    t: p.t,
    order: 0,
    text: `${p.t},${60_000 / p.bpm},${p.meter ?? 4},1,0,100,1,0`,
  }));
  let speed = 1;
  let section = map.timing[0];
  for (const o of map.objects) {
    const here = timingAt(map.timing, o.t);
    if (here !== section) {
      section = here;
      speed = 1;
    }
    if (o.kind !== 'slider') continue;
    const wanted = Math.max(0.1, Math.min(10, sliderSpeed(map, o)));
    if (Math.abs(wanted - speed) < 0.001) continue;
    speed = wanted;
    timing.push({ t: o.t, order: 1, text: `${o.t},${-100 / wanted},4,1,0,100,0,0` });
  }
  timing.sort((a, b) => a.t - b.t || a.order - b.order);

  const lines = [
    'osu file format v14',
    '',
    '[General]',
    `AudioFilename: ${clean(audioFile) || 'audio.mp3'}`,
    `AudioLeadIn: ${map.lead ?? 0}`,
    'Mode: 0',
    '',
    '[Metadata]',
    `Title:${clean(credit.title ?? name)}`,
    `TitleUnicode:${clean(credit.title ?? name)}`,
    `Artist:${clean(credit.artist)}`,
    `ArtistUnicode:${clean(credit.artist)}`,
    `Creator:${clean(credit.mapper)}`,
    `Version:${clean(credit.version ?? name)}`,
    `Source:${clean(credit.source)}`,
    '',
    '[Difficulty]',
    `HPDrainRate:${map.difficulty.drain}`,
    `CircleSize:${map.difficulty.size}`,
    `OverallDifficulty:${map.difficulty.accuracy}`,
    `ApproachRate:${map.difficulty.approach}`,
    `SliderMultiplier:${MULTIPLIER}`,
    `SliderTickRate:${map.ticks ?? 1}`,
    '',
    '[TimingPoints]',
    ...timing.map((l) => l.text),
    '',
    '[HitObjects]',
    ...map.objects.map((o, i) => objectLine(o, i === 0, map)),
    '',
  ];
  return lines.join('\r\n');
}
