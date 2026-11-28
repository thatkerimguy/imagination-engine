// Tiny 2D particle simulation + painter for particle-field (no allocation per frame).
export type Preset = 'blossoms' | 'embers' | 'snow' | 'digital-rain' | 'fireflies' | 'ash';
export const PRESETS: readonly Preset[] = [
  'blossoms',
  'embers',
  'snow',
  'digital-rain',
  'fireflies',
  'ash',
];

export interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ph: number;
}
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

// [vy min, vy max, radius min, radius max] in px/s and px.
const SPEC: Record<Preset, [number, number, number, number]> = {
  blossoms: [26, 48, 3, 5],
  embers: [-62, -28, 1, 2.6],
  snow: [20, 44, 1, 2.6],
  'digital-rain': [120, 210, 3, 6],
  fireflies: [-4, 4, 1.4, 2.4],
  ash: [14, 30, 1, 2.2],
};

export function spawn(preset: Preset, w: number, h: number, fresh: boolean): P {
  const [v0, v1, r0, r1] = SPEC[preset];
  const vy = rnd(v0, v1);
  const edge = vy < 0 ? h + 8 : -8;
  return {
    x: rnd(0, w),
    y: preset === 'fireflies' || fresh ? rnd(0, h) : edge,
    vx: preset === 'fireflies' ? rnd(-8, 8) : rnd(-4, 4),
    vy,
    r: rnd(r0, r1),
    ph: rnd(0, 6.28),
  };
}

export function step(
  p: P,
  preset: Preset,
  sec: number,
  wind: number,
  speed: number,
  w: number,
  h: number,
): void {
  p.ph += sec * (preset === 'fireflies' ? 1.2 : 1.6);
  const sway = preset === 'blossoms' || preset === 'snow' ? Math.sin(p.ph) * 14 : 0;
  const drift = preset === 'fireflies' ? Math.cos(p.ph * 0.7) * 10 : 0;
  p.x += (p.vx + sway + drift + wind * 40) * speed * sec;
  p.y += (p.vy + (preset === 'fireflies' ? Math.sin(p.ph) * 8 : 0)) * speed * sec;
  if (p.x < -10) p.x = w + 10;
  else if (p.x > w + 10) p.x = -10;
  if (p.y > h + 10 || p.y < -10) Object.assign(p, spawn(preset, w, h, false));
}

export function paint(
  g: CanvasRenderingContext2D,
  ps: readonly P[],
  preset: Preset,
  color: string,
  h: number,
  light = false,
): void {
  g.fillStyle = color;
  for (const p of ps) {
    switch (preset) {
      case 'blossoms':
        g.globalAlpha = 0.75;
        g.beginPath();
        g.ellipse(p.x, p.y, p.r * 1.4, p.r * 0.8, p.ph, 0, 6.28);
        g.fill();
        break;
      case 'digital-rain':
        for (let k = 0; k < 4; k++) {
          g.globalAlpha = (1 - k / 4) * 0.8;
          g.fillRect(p.x, p.y - k * p.r * 1.6, 1.6, p.r * 1.4);
        }
        break;
      default: {
        const a =
          preset === 'embers'
            ? (light ? 0.5 : 0.25) + (light ? 0.5 : 0.7) * (1 - p.y / h)
            : preset === 'fireflies'
              ? 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(p.ph))
              : preset === 'ash'
                ? 0.45
                : 0.75;
        g.globalAlpha = Math.max(0, Math.min(1, a));
        g.beginPath();
        g.arc(p.x, p.y, light && preset === 'embers' ? p.r + 0.5 : p.r, 0, 6.28);
        g.fill();
      }
    }
  }
  g.globalAlpha = 1;
}
