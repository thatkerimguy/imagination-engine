// Pure flame math and 2D drawing. Nothing here touches the DOM at import time.
export const MAX_TILT_DEG = 22;
export const MAX_DT = 0.05;

export interface Sway {
  angle: number;
  velocity: number;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const clampDt = (dt: number): number => (Number.isFinite(dt) ? clamp(dt, 0, MAX_DT) : 0);
export const clampAngle = (deg: number): number => clamp(deg, -MAX_TILT_DEG, MAX_TILT_DEG);

/** Phone roll (deviceorientation gamma) to a target flame lean; the flame leans against the tilt. */
export const gammaToAngle = (gamma: number): number => clampAngle(-gamma * 0.8);

/** Damped spring toward a clamped target angle (semi-implicit Euler, dt clamped). */
export function stepSway(s: Sway, target: number, dtRaw: number): Sway {
  const dt = clampDt(dtRaw);
  const velocity = (s.velocity + (clampAngle(target) - s.angle) * 60 * dt) * Math.exp(-7 * dt);
  return { angle: clampAngle(s.angle + velocity * dt), velocity };
}

/** Organic idle lean in degrees: slow sines plus a cheap pseudo-noise term. */
export function breeze(t: number): number {
  const n = Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.7);
  return clampAngle(Math.sin(t * 0.7) * 6 + Math.sin(t * 1.9 + 0.8) * 3 + n * 2);
}

/** Flame height multiplier, roughly 0.88 to 1.1. */
export function flicker(t: number, seed = 0): number {
  return 0.99 + 0.06 * Math.sin(t * 11 + seed) + 0.04 * Math.sin(t * 23.7 + seed * 2.3);
}

export interface Spark {
  x: number;
  y: number;
  alpha: number;
}

/** Three drifting embers, deterministic in time (`i` in 0..2). Offsets are in flame heights. */
export function sparkAt(i: number, t: number): Spark {
  const phase = (t * 0.45 + i / 3) % 1;
  return { x: Math.sin(t * 1.8 + i * 2.1) * 0.2, y: 0.55 + phase * 0.8, alpha: (1 - phase) * 0.7 };
}

export function drawFlame(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  angle: number,
  t: number,
  level: number,
): void {
  g.clearRect(0, 0, w, h);
  const cx = w / 2;
  const baseY = h - 6;
  const rad = (angle * Math.PI) / 180;
  const tear = (halfW: number, height: number, color: string, alpha: number): void => {
    const tipX = cx + Math.sin(rad) * height * 0.55;
    const tipY = baseY - Math.cos(rad) * height;
    g.beginPath();
    g.moveTo(cx, baseY);
    g.bezierCurveTo(
      cx - halfW * 1.3,
      baseY - height * 0.1,
      cx - halfW * 0.7,
      baseY - height * 0.6,
      tipX,
      tipY,
    );
    g.bezierCurveTo(
      cx + halfW * 0.7,
      baseY - height * 0.6,
      cx + halfW * 1.3,
      baseY - height * 0.1,
      cx,
      baseY,
    );
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fill();
  };
  const f = flicker(t) * level;
  tear(w * 0.4, (h - 14) * f, '#ff8a1e', 0.55);
  tear(w * 0.28, (h - 14) * 0.78 * flicker(t, 1.7) * level, '#ffc94a', 0.9);
  tear(w * 0.12, (h - 14) * 0.34 * flicker(t, 3.1) * level, '#dff0ff', 0.95);
  g.beginPath();
  g.ellipse(cx, baseY - 2, w * 0.1, 3, 0, 0, Math.PI * 2);
  g.globalAlpha = 0.8;
  g.fillStyle = '#5aa0ff';
  g.fill();
  for (let i = 0; i < 3; i++) {
    const s = sparkAt(i, t);
    g.beginPath();
    g.arc(cx + s.x * w + Math.sin(rad) * 14, baseY - s.y * h * 0.9, 1.2, 0, Math.PI * 2);
    g.globalAlpha = Math.max(0, s.alpha);
    g.fillStyle = '#ffd37a';
    g.fill();
  }
  g.globalAlpha = 1;
}
