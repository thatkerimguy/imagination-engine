// The lighter flame, painted into a small canvas each frame and used as an additive sprite
// texture. Gentle: height wobble stays within ±10 % and brightness never strobes (WCAG 2.3.1).
export const FLAME_W = 64;
export const FLAME_H = 128;

/** Flame height multiplier, about 0.9 .. 1.1, from slow layered sines. */
export function flicker(t: number, seed = 0): number {
  return 1 + 0.06 * Math.sin(t * 9 + seed) + 0.035 * Math.sin(t * 17.3 + seed * 2.3);
}

/** Slow organic lean in radians. */
export const lean = (t: number): number => Math.sin(t * 0.8) * 0.08 + Math.sin(t * 2.1 + 1) * 0.04;

export function paintFlame(g: CanvasRenderingContext2D, t: number, level: number): void {
  const w = FLAME_W;
  const h = FLAME_H;
  g.clearRect(0, 0, w, h);
  if (level <= 0) return;
  const cx = w / 2;
  const base = h - 6;
  const a = lean(t);
  const tear = (halfW: number, height: number, color: string, alpha: number): void => {
    const tipX = cx + Math.sin(a) * height * 0.6;
    const tipY = base - Math.cos(a) * height;
    g.beginPath();
    g.moveTo(cx, base);
    g.bezierCurveTo(
      cx - halfW * 1.3,
      base - height * 0.1,
      cx - halfW * 0.7,
      base - height * 0.6,
      tipX,
      tipY,
    );
    g.bezierCurveTo(
      cx + halfW * 0.7,
      base - height * 0.6,
      cx + halfW * 1.3,
      base - height * 0.1,
      cx,
      base,
    );
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fill();
  };
  const full = (h - 14) * level;
  tear(w * 0.36, full * flicker(t), '#ff8a1e', 0.55);
  tear(w * 0.25, full * 0.78 * flicker(t, 1.7), '#ffc94a', 0.9);
  tear(w * 0.11, full * 0.34 * flicker(t, 3.1), '#e4f2ff', 0.95);
  g.beginPath();
  g.ellipse(cx, base - 2, w * 0.1, 3, 0, 0, Math.PI * 2);
  g.globalAlpha = 0.75;
  g.fillStyle = '#5aa0ff';
  g.fill();
  g.globalAlpha = 1;
}
