import { ballAt, type PlayObject } from './prepare.ts';

const TAU = Math.PI * 2;

/**
 * Where Watch aims at `t`, written into `out`: on a slider's ball, round a spinner, or gliding
 * from the last note to the next. Returns true while it should hold.
 */
export function autoAim(
  objects: readonly PlayObject[],
  from: number,
  t: number,
  spinRate: number,
  out: { x: number; y: number },
): boolean {
  let active: PlayObject | undefined;
  let upcoming = -1;
  for (let i = Math.max(0, from - 1); i < objects.length; i++) {
    const o = objects[i] as PlayObject;
    if (o.t <= t && t <= o.end && o.kind !== 'circle') active = o;
    if (o.t > t) {
      upcoming = i;
      break;
    }
  }
  if (active?.kind === 'slider') {
    ballAt(active, t, out);
    return true;
  }
  if (active?.kind === 'spinner') {
    const a = (t / 1000) * TAU * Math.min(7, spinRate * 2);
    out.x = active.x + Math.cos(a) * 0.06;
    out.y = active.y + Math.sin(a) * 0.06;
    return true;
  }
  const next = objects[upcoming];
  if (!next) return false;
  const prev = objects[upcoming - 1] ?? next;
  const span = Math.max(1, next.t - prev.end);
  const f = Math.max(0, Math.min(1, (t - prev.end) / span));
  const ease = f * f * (3 - 2 * f);
  out.x = prev.endX + (next.x - prev.endX) * ease;
  out.y = prev.endY + (next.y - prev.endY) * ease;
  return false;
}
