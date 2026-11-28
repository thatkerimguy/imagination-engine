// audio-stinger icons: 14x14 monochrome Feather-style inline SVG (createElementNS only).
import { svgEl } from '../shared/dom-safe.ts';

type Shape = readonly [
  tag: 'path' | 'circle' | 'polyline' | 'polygon' | 'line',
  attrs: Record<string, string>,
];
const p = (d: string): Shape => ['path', { d }];
const c = (cx: string, cy: string, r: string): Shape => ['circle', { cx, cy, r }];
const pg = (points: string): Shape => ['polygon', { points }];
const pl = (points: string): Shape => ['polyline', { points }];
const ln = (x1: string, y1: string, x2: string, y2: string): Shape => ['line', { x1, y1, x2, y2 }];

const SHAPES: Record<string, readonly Shape[]> = {
  unsheathe: [p('M7 17L17 7M7 7h10v10')],
  thunder: [p('M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9M13 11l-4 6h6l-4 6')],
  'level-chord': [pl('23 6 13.5 15.5 8.5 10.5 1 18'), pl('17 6 23 6 23 12')],
  'revolver-click': [
    c('12', '12', '10'),
    ln('22', '12', '18', '12'),
    ln('6', '12', '2', '12'),
    ln('12', '6', '12', '2'),
    ln('12', '22', '12', '18'),
  ],
  'typewriter-bell': [p('M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0')],
  heartbeat: [pl('22 12 18 12 15 21 9 3 6 12 2 12')],
  'radio-static': [
    c('12', '12', '2'),
    p(
      'M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14',
    ),
  ],
};
const FALLBACK: readonly Shape[] = [
  pg('11 5 6 9 2 9 2 15 6 15 11 19 11 5'),
  p('M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07'),
];

export function iconFor(id: string): SVGSVGElement {
  const kids = (SHAPES[id] ?? FALLBACK).map(([tag, attrs]) => svgEl(tag, attrs));
  return svgEl(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: '14',
      height: '14',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
      class: 'kn-e-icon',
    },
    ...kids,
  );
}
