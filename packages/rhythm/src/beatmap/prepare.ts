import { FIELD_HEIGHT, type BeatmapDef, type HitObject } from '@ie/story';
import { pointAt, samplePath, type SampledPath } from './curve.ts';
import type { PlayRules } from './rules.ts';
import { beatLength } from './timing.ts';

export type CheckpointKind = 'tick' | 'repeat' | 'end';
export interface Checkpoint {
  readonly t: number;
  readonly kind: CheckpointKind;
  readonly x: number;
  readonly y: number;
}

/** A note ready to play: where it is drawn, its combo number, and a slider's checkpoints. */
export interface PlayObject {
  readonly index: number;
  readonly source: HitObject;
  readonly kind: HitObject['kind'];
  readonly t: number;
  readonly end: number;
  /** Where it is drawn (stacked notes shift a little), field units. */
  readonly x: number;
  readonly y: number;
  /** Where it ends: a slider's last crossing, else the head. */
  readonly endX: number;
  readonly endY: number;
  /** 1, 2, 3… within its combo. */
  readonly number: number;
  /** Which combo this is, counting from 0, for cycling colours. */
  readonly comboIndex: number;
  /** True when the next note continues this combo (draws the guide dots between them). */
  readonly joined: boolean;
  readonly path: SampledPath | null;
  /** Milliseconds per crossing (sliders). */
  readonly span: number;
  readonly checkpoints: readonly Checkpoint[];
}

export const FIELD_CENTRE = { x: 0.5, y: FIELD_HEIGHT / 2 } as const;
/** Notes this close together and this close in time stack, each shifted up and left. */
const STACK_DISTANCE = 3 / 512;
const STACK_SHIFT = 0.1;

function checkpointsFor(
  o: Extract<HitObject, { kind: 'slider' }>,
  path: SampledPath,
  span: number,
  tickGap: number,
  sx: number,
  sy: number,
): Checkpoint[] {
  const out: Checkpoint[] = [];
  const at = { x: 0, y: 0 };
  for (let slide = 0; slide < o.slides; slide++) {
    const forward = slide % 2 === 0;
    const start = o.t + slide * span;
    if (tickGap > 0 && tickGap < span) {
      // Ticks sit at whole tick gaps from the start of each crossing, not too near its end.
      for (let k = tickGap; k < span - 10; k += tickGap) {
        const f = k / span;
        pointAt(path, (forward ? f : 1 - f) * path.length, at);
        out.push({ t: start + k, kind: 'tick', x: at.x + sx, y: at.y + sy });
      }
    }
    const last = slide === o.slides - 1;
    pointAt(path, forward ? path.length : 0, at);
    out.push({ t: start + span, kind: last ? 'end' : 'repeat', x: at.x + sx, y: at.y + sy });
  }
  return out;
}

export function prepareObjects(map: BeatmapDef, rules: PlayRules): PlayObject[] {
  const objects = [...map.objects].sort((a, b) => a.t - b.t);
  const stacks = new Array<number>(objects.length).fill(0);
  for (let i = 1; i < objects.length; i++) {
    const a = objects[i - 1];
    const b = objects[i];
    if (!a || !b || a.kind === 'spinner' || b.kind === 'spinner') continue;
    const close = Math.hypot(a.x - b.x, a.y - b.y) < STACK_DISTANCE;
    if (close && b.t - a.t < rules.preempt * 0.7) stacks[i] = (stacks[i - 1] ?? 0) + 1;
  }

  const out: PlayObject[] = [];
  let number = 0;
  let comboIndex = -1;
  const ticksPerBeat = map.ticks ?? 1;
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i] as HitObject;
    if (i === 0 || o.combo || o.kind === 'spinner' || objects[i - 1]?.kind === 'spinner') {
      number = 0;
      comboIndex++;
    }
    number++;
    const shift = -(stacks[i] ?? 0) * rules.radius * STACK_SHIFT;
    const next = objects[i + 1];
    const joined = !!next && !next.combo && next.kind !== 'spinner' && o.kind !== 'spinner';
    if (o.kind === 'spinner') {
      out.push({
        index: i,
        source: o,
        kind: o.kind,
        t: o.t,
        end: Math.max(o.t, o.end),
        x: FIELD_CENTRE.x,
        y: FIELD_CENTRE.y,
        endX: FIELD_CENTRE.x,
        endY: FIELD_CENTRE.y,
        number,
        comboIndex,
        joined: false,
        path: null,
        span: 0,
        checkpoints: [],
      });
      continue;
    }
    const x = o.x + shift;
    const y = o.y + shift;
    if (o.kind === 'circle') {
      out.push({
        index: i,
        source: o,
        kind: o.kind,
        t: o.t,
        end: o.t,
        x,
        y,
        endX: x,
        endY: y,
        number,
        comboIndex,
        joined,
        path: null,
        span: 0,
        checkpoints: [],
      });
      continue;
    }
    const path = samplePath(o, o.curve, o.path, o.length);
    const end = Math.max(o.t + 1, o.end);
    const span = (end - o.t) / o.slides;
    const tickGap = ticksPerBeat > 0 ? beatLength(map.timing, o.t) / ticksPerBeat : 0;
    const checkpoints = checkpointsFor(o, path, span, tickGap, shift, shift);
    const last = checkpoints[checkpoints.length - 1];
    out.push({
      index: i,
      source: o,
      kind: o.kind,
      t: o.t,
      end,
      x,
      y,
      endX: last?.x ?? x,
      endY: last?.y ?? y,
      number,
      comboIndex,
      joined,
      path,
      span,
      checkpoints,
    });
  }
  return out;
}

/** Where a slider's ball is at time `t` (clamped to the slider), with stacking applied. */
export function ballAt(
  o: PlayObject,
  t: number,
  out: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  if (!o.path || o.span <= 0) {
    out.x = o.x;
    out.y = o.y;
    return out;
  }
  const elapsed = Math.max(0, Math.min(o.end - o.t, t - o.t));
  const slides = o.source.kind === 'slider' ? o.source.slides : 1;
  const slide = Math.min(slides - 1, Math.floor(elapsed / o.span));
  let f = (elapsed - slide * o.span) / o.span;
  if (slide % 2 === 1) f = 1 - f;
  pointAt(o.path, f * o.path.length, out);
  const sx = o.x - (o.source.kind === 'slider' ? o.source.x : o.x);
  const sy = o.y - (o.source.kind === 'slider' ? o.source.y : o.y);
  out.x += sx;
  out.y += sy;
  return out;
}

/** Stretches with no notes longer than this are breaks: health doesn't drain in them. */
export const BREAK_GAP = 4000;
