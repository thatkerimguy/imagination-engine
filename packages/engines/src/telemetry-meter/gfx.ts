// Pure-SVG graphics for telemetry-meter. Each builder returns the svg plus `set(v)` (draw the
// reading at value v) and an optional `loop(dtMs)` for the steady ekg / radar motion.
import { setText, svgEl } from '../shared/dom-safe.ts';

const S = 'kn-e-telemetry-meter';
export const STYLES = ['bars', 'countdown', 'ekg', 'radar', 'compass'] as const;
export type MeterStyle = (typeof STYLES)[number];

export interface MeterItem {
  name: string;
  value: number;
  max: number;
}
export interface GfxSpec {
  label: string;
  value: number;
  max: number;
  items: MeterItem[];
}
export interface Gfx {
  svg: SVGSVGElement;
  set(v: number): void;
  loop?(dtMs: number): void;
}

const frac = (n: number, d: number): number => (d > 0 ? Math.max(0, Math.min(1, n / d)) : 0);
const root = (vb: string, ...kids: Node[]): SVGSVGElement =>
  svgEl(
    'svg',
    { viewBox: vb, class: `${S}__svg`, 'aria-hidden': 'true', focusable: 'false' },
    ...kids,
  );
const circle = (r: number, cl: string): SVGCircleElement =>
  svgEl('circle', { class: `${S}__${cl}`, cx: 50, cy: 50, r });

function bars(s: GfxSpec): Gfx {
  const rows = [{ name: s.label, value: s.value, max: s.max, main: true }].concat(
    s.items.map((i) => ({ ...i, main: false })),
  );
  const parts = rows.map((r, i) => {
    const y = i * 22;
    const dims = { x: 0, y: y + 12, width: 200, height: 6, rx: 3 };
    const fill = svgEl('rect', { class: `kn-t ${S}__fill${r.main ? ' is-main' : ''}`, ...dims });
    const num = svgEl('text', { class: `${S}__t`, x: 200, y: y + 9, 'text-anchor': 'end' }, '0');
    const nodes = [
      svgEl('text', { class: `${S}__t`, x: 0, y: y + 9 }, r.name),
      num,
      svgEl('rect', { class: `${S}__track is-bar`, ...dims }),
      fill,
    ];
    return { r, fill, num, nodes };
  });
  return {
    svg: root(`0 0 200 ${rows.length * 22}`, ...parts.flatMap((p) => p.nodes)),
    set(v) {
      const f = frac(v, s.value);
      for (const p of parts) {
        p.fill.style.transform = `scaleX(${frac(f * p.r.value, p.r.max)})`;
        setText(p.num, String(Math.round(f * p.r.value)));
      }
    },
  };
}

function countdown(s: GfxSpec): Gfx {
  const arc = circle(44, 'arc');
  arc.setAttribute('class', `kn-t ${S}__arc`);
  arc.setAttribute('pathLength', '100');
  arc.setAttribute('transform', 'rotate(-90 50 50)');
  return {
    svg: root('0 0 100 100', circle(44, 'grid'), arc),
    set(v) {
      arc.style.strokeDashoffset = String(100 * (1 - frac(v, s.max)));
    },
  };
}

const BEAT = 'h8 l2 -3 l3 3 h6 l2 2 l3 -22 l3 30 l2 -9 h6 q3 -6 6 0 h9';
const BEAT_W = 50;

function ekg(s: GfxSpec): Gfx {
  const line = svgEl('path', {
    class: `kn-t ${S}__line`,
    d: `M0 30 ${Array.from({ length: 7 }, () => BEAT).join(' ')}`,
  });
  const g = svgEl('g', {}, line);
  const base = svgEl('line', { class: `${S}__grid`, x1: 0, y1: 30, x2: 200, y2: 30 });
  const speed = Math.min(1.8, Math.max(0.6, s.value / 60));
  let phase = 0;
  return {
    svg: root('0 0 200 60', base, g),
    set(v) {
      line.style.transform = `scaleY(${Math.max(0.04, frac(v, s.value))})`;
    },
    loop(dt) {
      phase = (phase + (dt / 1000) * speed * BEAT_W) % BEAT_W;
      g.style.transform = `translateX(${-phase.toFixed(2)}px)`;
    },
  };
}

function radar(s: GfxSpec): Gfx {
  const wedge = svgEl('path', { class: `${S}__sweep`, d: 'M50 50 L50 6 A44 44 0 0 1 72 12 Z' });
  const sweep = svgEl('g', {}, wedge);
  sweep.style.transformOrigin = '50px 50px';
  const range = circle(44, 'range');
  range.setAttribute('class', `kn-t ${S}__range`);
  const n = Math.max(1, s.items.length);
  const blips = svgEl(
    'g',
    {},
    ...s.items.map((it, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2 + 0.6;
      const r = 6 + 38 * frac(it.value, it.max);
      return svgEl('circle', {
        class: `${S}__blip`,
        cx: (50 + Math.cos(a) * r).toFixed(1),
        cy: (50 + Math.sin(a) * r).toFixed(1),
        r: 2.2,
      });
    }),
  );
  let angle = 35;
  const turn = (): void => {
    sweep.style.transform = `rotate(${angle.toFixed(1)}deg)`;
  };
  turn();
  return {
    svg: root(
      '0 0 100 100',
      circle(14, 'grid'),
      circle(29, 'grid'),
      circle(44, 'grid'),
      svgEl('path', { class: `${S}__grid`, d: 'M50 6 V94 M6 50 H94' }),
      sweep,
      range,
      blips,
    ),
    set(v) {
      range.style.transform = `scale(${frac(v, s.max)})`;
      blips.style.opacity = String(frac(v, s.value));
    },
    loop(dt) {
      angle = (angle + dt * 0.09) % 360;
      turn();
    },
  };
}

function compass(): Gfx {
  const needle = svgEl('path', { class: `kn-t ${S}__needle`, d: 'M50 12 L57 50 L50 58 L43 50 Z' });
  const ticks = Array.from({ length: 12 }, (_v, i) =>
    svgEl('line', {
      class: `${S}__grid`,
      x1: 50,
      y1: 6,
      x2: 50,
      y2: i % 3 === 0 ? 15 : 11,
      transform: `rotate(${i * 30} 50 50)`,
    }),
  );
  const letter = (t: string, x: number, y: number): SVGTextElement =>
    svgEl('text', { class: `${S}__t is-n`, x, y, 'text-anchor': 'middle' }, t);
  return {
    svg: root(
      '0 0 100 100',
      circle(44, 'grid'),
      ...ticks,
      letter('N', 50, 26),
      letter('E', 77, 53),
      letter('S', 50, 82),
      letter('W', 23, 53),
      needle,
    ),
    set(v) {
      needle.style.transform = `rotate(${v}deg)`;
    },
  };
}

export function buildGfx(style: MeterStyle, spec: GfxSpec): Gfx {
  switch (style) {
    case 'bars':
      return bars(spec);
    case 'countdown':
      return countdown(spec);
    case 'ekg':
      return ekg(spec);
    case 'radar':
      return radar(spec);
    case 'compass':
      return compass();
  }
}
