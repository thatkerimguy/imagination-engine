// audio-bed icons: 14x14 monochrome Feather-style inline SVG (createElementNS only).
import { svgEl } from '../shared/dom-safe.ts';

type Shape = readonly [
  tag: 'path' | 'circle' | 'polyline' | 'polygon' | 'line',
  attrs: Record<string, string>,
];
const p = (d: string): Shape => ['path', { d }];
const c = (cx: string, cy: string, r: string): Shape => ['circle', { cx, cy, r }];
const pg = (points: string): Shape => ['polygon', { points }];

const SHAPES: Record<string, readonly Shape[]> = {
  'rain-tin': [p('M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25')],
  'barroom-hum': [
    p('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'),
    c('9', '7', '4'),
    p('M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'),
  ],
  'starship-bridge': [pg('3 11 22 2 13 21 11 13 3 11')],
  'ocean-surf': [p('M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z')],
  'forest-wind': [
    p(
      'M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2',
    ),
  ],
  'vinyl-crackle': [c('12', '12', '10'), c('12', '12', '3')],
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
