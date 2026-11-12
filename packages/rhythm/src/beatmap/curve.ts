import type { FieldPoint, SliderCurve } from '@ie/story';

/** A slider's path as a polyline, with the distance along it at every point. */
export interface SampledPath {
  /** x, y pairs. */
  readonly points: Float32Array;
  /** Distance from the head at each point; the last is `length`. */
  readonly distances: Float32Array;
  readonly length: number;
}

/** About one sample per this many field widths of curve. */
const STEP = 0.004;
const MAX_SAMPLES = 2048;

type P = readonly [number, number];

function dist(a: P, b: P): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function polygonLength(points: readonly P[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1] as P, points[i] as P);
  return total;
}

function bezierPoint(points: readonly P[], t: number): P {
  // De Casteljau: stable for the long control polygons imported charts use.
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  for (let k = points.length - 1; k > 0; k--) {
    for (let i = 0; i < k; i++) {
      xs[i] = (xs[i] as number) * (1 - t) + (xs[i + 1] as number) * t;
      ys[i] = (ys[i] as number) * (1 - t) + (ys[i + 1] as number) * t;
    }
  }
  return [xs[0] as number, ys[0] as number];
}

function bezier(control: readonly P[]): P[] {
  // A point given twice ends one curve and starts the next.
  const out: P[] = [];
  let segment: P[] = [];
  const flush = () => {
    if (segment.length === 0) return;
    if (segment.length === 1) {
      out.push(segment[0] as P);
    } else {
      const steps = Math.min(512, Math.max(4, Math.ceil(polygonLength(segment) / STEP)));
      for (let i = out.length === 0 ? 0 : 1; i <= steps; i++)
        out.push(bezierPoint(segment, i / steps));
    }
  };
  for (let i = 0; i < control.length; i++) {
    const p = control[i] as P;
    const prev = control[i - 1];
    if (prev && dist(prev, p) < 1e-6) {
      flush();
      segment = [p];
      continue;
    }
    segment.push(p);
  }
  flush();
  return out;
}

function arc(a: P, b: P, c: P): P[] | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a[0] ** 2 + a[1] ** 2;
  const b2 = b[0] ** 2 + b[1] ** 2;
  const c2 = c[0] ** 2 + c[1] ** 2;
  const cx = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
  const cy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
  const r = Math.hypot(a[0] - cx, a[1] - cy);
  const start = Math.atan2(a[1] - cy, a[0] - cx);
  let end = Math.atan2(c[1] - cy, c[0] - cx);
  // Which way round: the side the middle point is on.
  const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (cross < 0) {
    while (end > start) end -= Math.PI * 2;
  } else {
    while (end < start) end += Math.PI * 2;
  }
  const span = end - start;
  const steps = Math.min(512, Math.max(8, Math.ceil((Math.abs(span) * r) / STEP)));
  const out: P[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = start + (span * i) / steps;
    out.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  return out;
}

function smooth(control: readonly P[]): P[] {
  // Catmull-Rom through every point, the ends repeated.
  const out: P[] = [control[0] as P];
  for (let i = 0; i < control.length - 1; i++) {
    const p1 = control[i] as P;
    const p0 = control[i - 1] ?? p1;
    const p2 = control[i + 1] as P;
    const p3 = control[i + 2] ?? p2;
    const steps = Math.min(256, Math.max(4, Math.ceil(dist(p1, p2) / STEP)));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (k: 0 | 1) =>
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([at(0), at(1)]);
    }
  }
  return out;
}

function shape(head: FieldPoint, curve: SliderCurve, path: readonly FieldPoint[]): P[] {
  const control: P[] = [[head.x, head.y], ...path.map((p): P => [p.x, p.y])];
  switch (curve) {
    case 'line':
      return control;
    case 'arc':
      if (control.length === 3) {
        const round = arc(control[0] as P, control[1] as P, control[2] as P);
        if (round) return round;
      }
      return bezier(control);
    case 'smooth':
      return smooth(control);
    default:
      return bezier(control);
  }
}

/**
 * Samples a slider's path. With `length`, the path is cut there, or its last stretch carried on
 * in the same direction when the curve is shorter (imported charts rely on both).
 */
export function samplePath(
  head: FieldPoint,
  curve: SliderCurve,
  path: readonly FieldPoint[],
  length?: number,
): SampledPath {
  const raw = shape(head, curve, path);
  const pts: P[] = [];
  for (const p of raw) {
    const last = pts[pts.length - 1];
    if (!last || dist(last, p) > 1e-7) pts.push(p);
  }
  if (pts.length === 1) pts.push(pts[0] as P);
  // Thin very long paths evenly so drawing stays cheap.
  const step = Math.max(1, Math.ceil(pts.length / MAX_SAMPLES));
  const kept = step === 1 ? pts : pts.filter((_, i) => i % step === 0 || i === pts.length - 1);

  const distances: number[] = [0];
  for (let i = 1; i < kept.length; i++)
    distances.push((distances[i - 1] as number) + dist(kept[i - 1] as P, kept[i] as P));
  let total = distances[distances.length - 1] as number;

  if (length !== undefined && length > 0 && Math.abs(length - total) > 1e-6) {
    if (length < total) {
      let i = distances.findIndex((d) => d >= length);
      if (i < 1) i = 1;
      const a = kept[i - 1] as P;
      const b = kept[i] as P;
      const span = (distances[i] as number) - (distances[i - 1] as number);
      const f = span > 0 ? (length - (distances[i - 1] as number)) / span : 0;
      kept.length = i;
      distances.length = i;
      kept.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      distances.push(length);
    } else {
      const a = kept[kept.length - 2] as P;
      const b = kept[kept.length - 1] as P;
      const span = dist(a, b);
      const extra = length - total;
      const dx = span > 0 ? (b[0] - a[0]) / span : 1;
      const dy = span > 0 ? (b[1] - a[1]) / span : 0;
      kept.push([b[0] + dx * extra, b[1] + dy * extra]);
      distances.push(length);
    }
    total = length;
  }

  const points = new Float32Array(kept.length * 2);
  kept.forEach((p, i) => {
    points[i * 2] = p[0];
    points[i * 2 + 1] = p[1];
  });
  return { points, distances: Float32Array.from(distances), length: total };
}

/** The point `d` along the path, clamped to its ends. Writes into `out` to avoid garbage. */
export function pointAt(
  path: SampledPath,
  d: number,
  out: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  const { points, distances } = path;
  const n = distances.length;
  if (d <= 0 || n < 2) {
    out.x = points[0] ?? 0;
    out.y = points[1] ?? 0;
    return out;
  }
  if (d >= path.length) {
    out.x = points[(n - 1) * 2] ?? 0;
    out.y = points[(n - 1) * 2 + 1] ?? 0;
    return out;
  }
  // Binary search: sliders are sampled every few thousandths of the field.
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((distances[mid] as number) <= d) lo = mid;
    else hi = mid;
  }
  const d0 = distances[lo] as number;
  const span = (distances[hi] as number) - d0;
  const f = span > 0 ? (d - d0) / span : 0;
  out.x = (points[lo * 2] as number) + ((points[hi * 2] as number) - (points[lo * 2] as number)) * f;
  out.y =
    (points[lo * 2 + 1] as number) +
    ((points[hi * 2 + 1] as number) - (points[lo * 2 + 1] as number)) * f;
  return out;
}

/** The natural length of a slider's path, for the editor and the .osu writer. */
export function naturalLength(
  head: FieldPoint,
  curve: SliderCurve,
  path: readonly FieldPoint[],
): number {
  return samplePath(head, curve, path).length;
}
