import { createId } from '@ie/core';
import {
  FIELD_HEIGHT,
  type BeatmapDef,
  type HitObject,
  type Label,
  type StoryProject,
  type TimingPoint,
  type Track,
} from '@ie/story';

/*
 * Pure edits for beatmaps (ADR 0033), so the editor's buttons and drags stay one-liners and the
 * rules (notes in time order, at least one tempo, positions on the field) live in one tested place.
 */

export const DEFAULT_DIFFICULTY = { size: 4, approach: 6, accuracy: 5, drain: 4 } as const;

export function beatmapsOf(doc: StoryProject): readonly BeatmapDef[] {
  return doc.beatmaps ?? [];
}

/** The tempo a track already knows: its calibration, else its beat analysis. */
export function timingFromTrack(track: Track | undefined): TimingPoint | null {
  const c = track?.calibration;
  if (c) return { t: Math.round(c.offset * 1000), bpm: c.bpm, ...meter(c.beatsPerBar) };
  const a = track?.analysis;
  if (!a || a.bpm <= 0) return null;
  const downbeat = a.beats[a.downbeats[0] ?? 0] ?? a.beats[0] ?? 0;
  return {
    t: Math.round(downbeat * 1000),
    bpm: Math.round(a.bpm * 100) / 100,
    ...meter(a.beatsPerBar),
  };
}

function meter(beats: number): { meter?: number } {
  return beats !== 4 && beats >= 1 && beats <= 16 ? { meter: beats } : {};
}

export function newBeatmap(name: Label, track?: Track): BeatmapDef {
  return {
    id: createId('bm'),
    name,
    ...(track ? { track: track.id } : {}),
    difficulty: { ...DEFAULT_DIFFICULTY },
    timing: [timingFromTrack(track) ?? { t: 0, bpm: 120 }],
    objects: [],
  };
}

export function addBeatmaps(doc: StoryProject, maps: readonly BeatmapDef[]): StoryProject {
  if (maps.length === 0) return doc;
  return { ...doc, beatmaps: [...beatmapsOf(doc), ...maps].slice(0, 64) };
}

export function updateBeatmap(
  doc: StoryProject,
  id: string,
  change: (map: BeatmapDef) => BeatmapDef,
): StoryProject {
  const maps = beatmapsOf(doc);
  const i = maps.findIndex((m) => m.id === id);
  const map = maps[i];
  if (!map) return doc;
  const next = change(map);
  if (next === map) return doc;
  return { ...doc, beatmaps: maps.map((m, k) => (k === i ? next : m)) };
}

export function removeBeatmap(doc: StoryProject, id: string): StoryProject {
  const rest = beatmapsOf(doc).filter((m) => m.id !== id);
  if (rest.length > 0) return { ...doc, beatmaps: rest };
  const { beatmaps: _gone, ...without } = doc;
  return without;
}

const byTime = (a: HitObject, b: HitObject) => a.t - b.t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = (v: number) => Math.round(v * 100000) / 100000;

export function addObject(map: BeatmapDef, object: HitObject): BeatmapDef {
  return { ...map, objects: [...map.objects, object].sort(byTime) };
}

export function removeObjects(map: BeatmapDef, ids: ReadonlySet<string>): BeatmapDef {
  if (ids.size === 0) return map;
  return { ...map, objects: map.objects.filter((o) => !ids.has(o.id)) };
}

export function setObject(
  map: BeatmapDef,
  id: string,
  change: (o: HitObject) => HitObject,
): BeatmapDef {
  let changed = false;
  const objects = map.objects.map((o) => {
    if (o.id !== id) return o;
    const next = change(o);
    changed ||= next !== o;
    return next;
  });
  return changed ? { ...map, objects: objects.sort(byTime) } : map;
}

/** Moves notes (and their slider paths) on the field, keeping every point on it. */
export function moveObjects(
  map: BeatmapDef,
  ids: ReadonlySet<string>,
  dx: number,
  dy: number,
): BeatmapDef {
  if (ids.size === 0 || (dx === 0 && dy === 0)) return map;
  // One shared shift for the whole selection, limited so no point leaves the field.
  let lo = { x: -Infinity, y: -Infinity };
  let hi = { x: Infinity, y: Infinity };
  for (const o of map.objects) {
    if (!ids.has(o.id) || o.kind === 'spinner') continue;
    for (const p of o.kind === 'slider' ? [o, ...o.path] : [o]) {
      lo = { x: Math.max(lo.x, -p.x), y: Math.max(lo.y, -p.y) };
      hi = { x: Math.min(hi.x, 1 - p.x), y: Math.min(hi.y, FIELD_HEIGHT - p.y) };
    }
  }
  const sx = clamp(dx, lo.x, hi.x);
  const sy = clamp(dy, lo.y, hi.y);
  const shift = <P extends { x: number; y: number }>(p: P): P => ({
    ...p,
    x: round(p.x + sx),
    y: round(p.y + sy),
  });
  return {
    ...map,
    objects: map.objects.map((o) => {
      if (!ids.has(o.id) || o.kind === 'spinner') return o;
      if (o.kind === 'slider') return { ...shift(o), path: o.path.map(shift) };
      return shift(o);
    }),
  };
}

/** Shifts notes in time, sliders' and spinners' ends with them. */
export function retimeObjects(
  map: BeatmapDef,
  ids: ReadonlySet<string>,
  dt: number,
): BeatmapDef {
  if (ids.size === 0 || dt === 0) return map;
  const objects = map.objects.map((o): HitObject => {
    if (!ids.has(o.id)) return o;
    const t = Math.max(0, Math.round(o.t + dt));
    return o.kind === 'circle' ? { ...o, t } : { ...o, t, end: o.end + (t - o.t) };
  });
  return { ...map, objects: objects.sort(byTime) };
}

export function toggleCombo(map: BeatmapDef, ids: ReadonlySet<string>): BeatmapDef {
  if (ids.size === 0) return map;
  const all = map.objects.filter((o) => ids.has(o.id)).every((o) => o.combo);
  return {
    ...map,
    objects: map.objects.map((o): HitObject => {
      if (!ids.has(o.id)) return o;
      if (all) {
        const { combo: _off, ...rest } = o;
        return rest;
      }
      return { ...o, combo: true };
    }),
  };
}

/** Adds a tempo change, replacing one at the same moment. */
export function putTiming(map: BeatmapDef, point: TimingPoint): BeatmapDef {
  const rest = map.timing.filter((p) => p.t !== point.t);
  return { ...map, timing: [...rest, point].sort((a, b) => a.t - b.t) };
}

/** Removes a tempo change; the last one stays (a chart needs a tempo). */
export function removeTiming(map: BeatmapDef, t: number): BeatmapDef {
  if (map.timing.length <= 1) return map;
  return { ...map, timing: map.timing.filter((p) => p.t !== t) };
}

/** Moves every note and tempo change by `dt` ms, for a song that starts sooner or later. */
export function shiftMap(map: BeatmapDef, dt: number): BeatmapDef {
  if (dt === 0) return map;
  const all = new Set(map.objects.map((o) => o.id));
  return {
    ...retimeObjects(map, all, dt),
    timing: map.timing.map((p) => ({ ...p, t: Math.round(p.t + dt) })),
  };
}

export function newObjectId(): string {
  return createId('n');
}
