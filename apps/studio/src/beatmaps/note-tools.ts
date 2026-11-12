import { beatLength, naturalLength, snapTime, timingAt, type PlayObject, type PlayRules } from '@ie/rhythm';
import {
  BEATMAP_LIMITS,
  FIELD_HEIGHT,
  type FieldPoint,
  type HitObject,
  type HitSlider,
  type HitSpinner,
  type TimingPoint,
} from '@ie/story';

/*
 * What the note editor's tools do, as pure functions over the beatmap (ADR 0033): finding the
 * note under the pointer, turning a drawn slider into a note, stepping along the beat grid, and
 * copying notes to another moment.
 */

export const TOOLS = ['select', 'circle', 'slider', 'spinner'] as const;
export type Tool = (typeof TOOLS)[number];
export const SNAPS = [1, 2, 3, 4, 6, 8, 12, 16] as const;

/** How far a slider's ball travels per beat when it is drawn, in field widths. */
export const SLIDER_SPEED = 0.27;
const SPINNER_RADIUS = 0.28;

export const clampToField = (p: FieldPoint): FieldPoint => ({
  x: Math.round(Math.max(0, Math.min(1, p.x)) * 10000) / 10000,
  y: Math.round(Math.max(0, Math.min(FIELD_HEIGHT, p.y)) * 10000) / 10000,
});

/** Notes the editor shows at `t`: from their approach until a little after they end. */
export function isShown(o: PlayObject, t: number, rules: PlayRules): boolean {
  return t >= o.t - rules.preempt && t <= o.end + 400;
}

/** The shown note under a field point, the one nearest the playhead in time first. */
export function hitTest(
  objects: readonly PlayObject[],
  t: number,
  rules: PlayRules,
  x: number,
  y: number,
): PlayObject | null {
  let best: PlayObject | null = null;
  let bestGap = Infinity;
  const r = rules.radius * 1.1;
  for (const o of objects) {
    if (!isShown(o, t, rules)) continue;
    let hit: boolean;
    if (o.kind === 'spinner') hit = Math.hypot(x - o.x, y - o.y) <= SPINNER_RADIUS;
    else hit = Math.hypot(x - o.x, y - o.y) <= r || onPath(o, x, y, r);
    if (!hit) continue;
    const gap = Math.abs(o.t - t);
    if (gap < bestGap) {
      best = o;
      bestGap = gap;
    }
  }
  return best;
}

function onPath(o: PlayObject, x: number, y: number, r: number): boolean {
  if (!o.path || o.source.kind !== 'slider') return false;
  const sx = o.x - o.source.x;
  const sy = o.y - o.source.y;
  const pts = o.path.points;
  for (let k = 0; k < pts.length; k += 2) {
    if (Math.hypot(x - (pts[k] as number) - sx, y - (pts[k + 1] as number) - sy) <= r) return true;
  }
  return false;
}

/** The next (or previous) grid line from `t` at `divisor` lines per beat. */
export function stepTime(
  timing: readonly TimingPoint[],
  t: number,
  divisor: number,
  direction: 1 | -1,
): number {
  const step = beatLength(timing, t) / divisor;
  const here = snapTime(timing, t, divisor);
  // Off the grid, the first step only lands on it.
  if (direction > 0 ? here > t + 0.5 : here < t - 0.5) return Math.max(0, here);
  return Math.max(0, snapTime(timing, here + direction * step, divisor));
}

/** A length in beats rounded to the grid, at least one line long. */
function gridBeats(beats: number, divisor: number): number {
  return Math.max(1 / divisor, Math.round(beats * divisor) / divisor);
}

/** A drawn slider: its head and the points clicked after it. */
export interface SliderDraft {
  readonly t: number;
  readonly points: readonly FieldPoint[];
}

export function sliderFromDraft(
  draft: SliderDraft,
  timing: readonly TimingPoint[],
  divisor: number,
  id: string,
): HitSlider | null {
  const [head, ...path] = draft.points.map(clampToField);
  if (!head || path.length === 0) return null;
  const curve = path.length === 1 ? 'line' : 'bezier';
  const length = naturalLength(head, curve, path);
  if (length < 0.01) return null;
  const beats = gridBeats(length / SLIDER_SPEED, divisor);
  return {
    id,
    kind: 'slider',
    t: draft.t,
    x: head.x,
    y: head.y,
    curve,
    path: path.slice(0, BEATMAP_LIMITS.path),
    slides: 1,
    end: Math.round(draft.t + beats * beatLength(timing, draft.t)),
  };
}

/** A spinner from `t` lasting one bar. */
export function spinnerAt(timing: readonly TimingPoint[], t: number, id: string): HitSpinner {
  const meter = timingAt(timing, t).meter ?? 4;
  return { id, kind: 'spinner', t, end: Math.round(t + meter * beatLength(timing, t)) };
}

/** A note's length in beats (sliders and spinners), for the inspector. */
export function lengthInBeats(o: HitSlider | HitSpinner, timing: readonly TimingPoint[]): number {
  return Math.round(((o.end - o.t) / beatLength(timing, o.t)) * 100) / 100;
}

export function withLength<O extends HitSlider | HitSpinner>(
  o: O,
  beats: number,
  timing: readonly TimingPoint[],
): O {
  const end = Math.round(o.t + Math.max(0.0625, beats) * beatLength(timing, o.t));
  return { ...o, end };
}

/** Copied notes, timed from the first one. */
export interface Clip {
  readonly objects: readonly HitObject[];
}

export function copyObjects(objects: readonly HitObject[], ids: ReadonlySet<string>): Clip | null {
  const picked = objects.filter((o) => ids.has(o.id));
  const first = picked[0];
  if (!first) return null;
  return { objects: picked.map((o) => retime(o, -first.t)) };
}

/** The clip's notes moved to `at`, with new IDs. */
export function pasteObjects(clip: Clip, at: number, newId: () => string): HitObject[] {
  return clip.objects.map((o) => ({ ...retime(o, at), id: newId() }));
}

function retime(o: HitObject, dt: number): HitObject {
  const t = Math.round((o.t + dt) * 100) / 100;
  if (o.kind === 'circle') return { ...o, t };
  return { ...o, t, end: Math.round((o.end + dt) * 100) / 100 };
}
