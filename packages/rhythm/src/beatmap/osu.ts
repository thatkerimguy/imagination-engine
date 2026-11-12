import type {
  BeatmapDef,
  FieldPoint,
  HitObject,
  SliderCurve,
  TimingPoint,
} from '@ie/story';
import { BEATMAP_LIMITS } from '@ie/story';

/*
 * Reads the text chart format of the popular circle-clicking game (.osu, versions 3 to 14) into a
 * BeatmapDef. Only the aim-and-tap mode is read; charts for its other modes are refused. The
 * playfield there is 512×384 units, so positions divide by 512 onto our field.
 */

const FIELD_UNITS = 512;

export type OsuProblem = 'not-a-chart' | 'other-mode' | 'no-objects';

export class OsuError extends Error {
  constructor(readonly problem: OsuProblem) {
    super(
      problem === 'other-mode'
        ? 'This chart is for another game mode.'
        : problem === 'no-objects'
          ? 'This chart has nothing to hit.'
          : "This isn't a chart file.",
    );
  }
}

export interface OsuChart {
  readonly beatmap: BeatmapDef;
  /** The song's file name inside the chart's folder or archive. */
  readonly audioFile: string;
  /** Where the song's preview starts, in milliseconds (or undefined). */
  readonly preview?: number;
}

interface Sections {
  readonly values: Map<string, Map<string, string>>;
  readonly lists: Map<string, string[]>;
}

const LIST_SECTIONS = new Set(['Events', 'TimingPoints', 'HitObjects', 'Colours']);

function sections(text: string): Sections {
  const values = new Map<string, Map<string, string>>();
  const lists = new Map<string, string[]>();
  let current = '';
  for (const rawLine of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;
    const header = /^\[(.+)]$/.exec(line);
    if (header) {
      current = header[1] ?? '';
      continue;
    }
    if (LIST_SECTIONS.has(current)) {
      const list = lists.get(current) ?? [];
      list.push(line);
      lists.set(current, list);
      continue;
    }
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const map = values.get(current) ?? new Map<string, string>();
    map.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
    values.set(current, map);
  }
  return { values, lists };
}

const num = (raw: string | undefined, fallback: number): number => {
  const n = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(n) ? n : fallback;
};
const clampDial = (n: number) => Math.max(0, Math.min(10, n));
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
/** Our times run from 10 s before the song to an hour in (BEATMAP_LIMITS). */
const inTime = (t: number) => t >= -10_000 && t <= BEATMAP_LIMITS.ms;
const round = (n: number, places = 5) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

interface TimingState {
  readonly t: number;
  readonly beat: number;
  readonly speed: number;
}

/** Tempo sections for our chart, and the beat length and slider speed at every change. */
function readTiming(lines: readonly string[]): {
  timing: TimingPoint[];
  states: TimingState[];
} {
  const raw = lines
    .map((line, order) => {
      const f = line.split(',');
      const beat = num(f[1], Number.NaN);
      // Old charts have no "uninherited" field: a positive beat length is a tempo.
      const uninherited = f[6] === undefined ? beat > 0 : f[6] === '1';
      return { t: num(f[0], 0), beat, meter: num(f[2], 4), uninherited, order };
    })
    .filter((p) => Number.isFinite(p.beat) && p.beat !== 0)
    // At one moment a tempo comes before a speed change, so the speed applies after it.
    .sort((a, b) => a.t - b.t || Number(b.uninherited) - Number(a.uninherited) || a.order - b.order);

  const timing: TimingPoint[] = [];
  const states: TimingState[] = [];
  let beat = 500;
  let speed: number;
  let first = true;
  for (const p of raw) {
    if (p.uninherited) {
      if (p.beat <= 0) continue;
      beat = p.beat;
      speed = 1;
      const point: TimingPoint = {
        t: round(p.t, 3),
        bpm: round(60_000 / p.beat, 4),
        ...(p.meter !== 4 && p.meter >= 1 && p.meter <= 16 ? { meter: Math.round(p.meter) } : {}),
      };
      // Charts use absurd tempos as tricks (a 1 ms beat); they still time sliders through
      // `states`, but the grid keeps the tempo before them.
      if (point.bpm >= 1 && point.bpm <= 2000 && inTime(point.t)) {
        // Two tempos at one moment: the later line wins.
        if (timing[timing.length - 1]?.t === point.t) timing[timing.length - 1] = point;
        else timing.push(point);
      }
      if (first) {
        // Speed changes before the first tempo use it too.
        for (let i = 0; i < states.length; i++) states[i] = { ...(states[i] as TimingState), beat };
        first = false;
      }
    } else {
      speed = Math.max(0.1, Math.min(10, -100 / p.beat));
    }
    states.push({ t: p.t, beat, speed });
  }
  return { timing: timing.slice(0, BEATMAP_LIMITS.timing), states };
}

function stateAt(states: readonly TimingState[], t: number): TimingState {
  let found = states[0] ?? { t: 0, beat: 500, speed: 1 };
  for (const s of states) {
    if (s.t > t) break;
    found = s;
  }
  return found;
}

const CURVES: Readonly<Record<string, SliderCurve>> = {
  B: 'bezier',
  L: 'line',
  P: 'arc',
  C: 'smooth',
};

/** A chart position on our field, kept within the margin the schema allows around it. */
function field(x: number, y: number): FieldPoint {
  const at = (n: number) => round(clamp(n / FIELD_UNITS, -0.5, 1.5));
  return { x: at(x), y: at(y) };
}

function readObjects(
  lines: readonly string[],
  states: readonly TimingState[],
  multiplier: number,
  newId: () => string,
): HitObject[] {
  const out: HitObject[] = [];
  let first = true;
  for (const line of lines) {
    if (out.length >= BEATMAP_LIMITS.objects) break;
    const f = line.split(',');
    const x = num(f[0], 256);
    const y = num(f[1], 192);
    const t = Math.round(num(f[2], Number.NaN));
    const type = num(f[3], 0);
    if (!Number.isFinite(t) || !inTime(t)) continue;
    const combo = first || (type & 4) !== 0 ? { combo: true as const } : {};
    const id = newId();
    if (type & 1) {
      out.push({ id, kind: 'circle', t, ...combo, ...field(x, y) });
    } else if (type & 2) {
      const parts = (f[5] ?? '').split('|');
      const curve = CURVES[parts[0] ?? ''] ?? 'bezier';
      let path = parts
        .slice(1)
        .map((p) => p.split(':'))
        .map(([px, py]) => field(num(px, x), num(py, y)))
        .slice(0, BEATMAP_LIMITS.path);
      const head = field(x, y);
      // Some charts repeat the head as the first point; for a curve that would read as a corner.
      if (path[0] && path[0].x === head.x && path[0].y === head.y) path = path.slice(1);
      if (path.length === 0) path = [head];
      const slides = Math.max(1, Math.min(100, Math.round(num(f[6], 1))));
      const pixels = num(f[7], 0);
      const state = stateAt(states, t);
      const span = pixels > 0 ? (pixels / (multiplier * 100 * state.speed)) * state.beat : state.beat;
      out.push({
        id,
        kind: 'slider',
        t,
        ...combo,
        ...head,
        curve: curve === 'arc' && path.length !== 2 ? 'bezier' : curve,
        path,
        ...(pixels > 0 ? { length: round(Math.min(20, pixels / FIELD_UNITS)) } : {}),
        slides,
        end: Math.min(BEATMAP_LIMITS.ms, Math.round(t + span * slides)),
      });
    } else if (type & 8) {
      const end = Math.round(num(f[5], t + 1000));
      out.push({
        id,
        kind: 'spinner',
        t,
        ...combo,
        end: Math.min(BEATMAP_LIMITS.ms, Math.max(t + 50, end)),
      });
    } else {
      continue;
    }
    first = false;
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Reads one .osu chart. `newId` makes an id for each note (`createId` in the apps). */
export function parseOsu(text: string, newId: () => string, mapId: string): OsuChart {
  if (!/osu file format/i.test(text.slice(0, 200)) && !text.includes('[HitObjects]'))
    throw new OsuError('not-a-chart');
  const { values, lists } = sections(text);
  const general = values.get('General') ?? new Map<string, string>();
  const meta = values.get('Metadata') ?? new Map<string, string>();
  const diff = values.get('Difficulty') ?? new Map<string, string>();
  if (num(general.get('Mode'), 0) !== 0) throw new OsuError('other-mode');

  const { timing, states } = readTiming(lists.get('TimingPoints') ?? []);
  const multiplier = Math.max(0.4, Math.min(3.6, num(diff.get('SliderMultiplier'), 1.4)));
  const objects = readObjects(lists.get('HitObjects') ?? [], states, multiplier, newId);
  if (objects.length === 0) throw new OsuError('no-objects');

  const accuracy = clampDial(num(diff.get('OverallDifficulty'), 5));
  const title = meta.get('TitleUnicode') || meta.get('Title') || '';
  const artist = meta.get('ArtistUnicode') || meta.get('Artist') || '';
  const version = meta.get('Version') ?? '';
  const name = [title, version].filter(Boolean).join(' · ') || 'Beatmap';
  const lead = num(general.get('AudioLeadIn'), 0);
  const preview = num(general.get('PreviewTime'), -1);
  const ticks = num(diff.get('SliderTickRate'), 1);
  const credit = Object.fromEntries(
    Object.entries({
      title,
      artist,
      mapper: meta.get('Creator') ?? '',
      version,
      source: meta.get('Source') ?? '',
    })
      .filter(([, v]) => v)
      .map(([k, v]) => [k, v.slice(0, 200)]),
  );

  return {
    beatmap: {
      id: mapId,
      name: { en: name.slice(0, 200), tr: name.slice(0, 200) },
      ...(lead > 0 ? { lead: Math.min(10_000, Math.round(lead)) } : {}),
      difficulty: {
        size: clampDial(num(diff.get('CircleSize'), 5)),
        // Old charts have no approach dial: it followed accuracy.
        approach: clampDial(num(diff.get('ApproachRate'), accuracy)),
        accuracy,
        drain: clampDial(num(diff.get('HPDrainRate'), 5)),
      },
      ...(ticks !== 1 ? { ticks: Math.max(0, Math.min(8, ticks)) } : {}),
      timing: timing.length > 0 ? timing : [{ t: 0, bpm: 120 }],
      objects,
      ...(Object.keys(credit).length > 0 ? { credit } : {}),
    },
    audioFile: general.get('AudioFilename') ?? '',
    ...(preview >= 0 ? { preview } : {}),
  };
}
