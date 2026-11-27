// tactile-reveal mechanism art: the embossed wax seal and the biometric ring. Pure vector nodes
// (svgEl only, no HTML strings). The seal is two accent halves with a 2-stop radial emboss sheen, an
// outer drop shadow (CSS) and a concentric stamped inner ring, so it reads as pressed wax in any
// book colour.
import { cls, svgEl } from '../shared/dom-safe.ts';

export const ID = 'tactile-reveal';
export const MECHANISMS = ['wax-seal', 'scratch-off', 'biometric-hold', 'fog-wipe'] as const;
export type Mechanism = (typeof MECHANISMS)[number];

const CRACK = 'L46 76 L52 60 L45 44 L51 28 Z';
let gradSeq = 0;

const svgRoot = (...children: SVGElement[]): SVGSVGElement =>
  svgEl(
    'svg',
    { viewBox: '0 0 100 100', class: cls(ID, 'svg'), 'aria-hidden': 'true', focusable: 'false' },
    ...children,
  );

export function sealSvg(): SVGSVGElement {
  const id = `kn-tr-emboss-${++gradSeq}`;
  const grad = svgEl(
    'radialGradient',
    { id, cx: '38%', cy: '34%', r: '70%' },
    svgEl('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': '0.34' }),
    svgEl('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': '0.32' }),
  );
  const half = (side: 'l' | 'r'): SVGGElement => {
    const d = `M50 6 A44 44 0 0 ${side === 'l' ? 0 : 1} 50 94 ${CRACK}`;
    return svgEl(
      'g',
      { class: `${cls(ID, 'half')} ${cls(ID, `half-${side}`)}` },
      svgEl('path', { d }),
      svgEl('path', { d, fill: `url(#${id})` }),
    );
  };
  return svgRoot(
    svgEl('defs', {}, grad),
    half('l'),
    half('r'),
    svgEl('circle', { class: `${cls(ID, 'rim')} ${cls(ID, 'ring')}`, cx: 50, cy: 50, r: 30 }),
    svgEl('circle', { class: `${cls(ID, 'stamp')} ${cls(ID, 'ring')}`, cx: 50, cy: 50, r: 23 }),
  );
}

export function ringSvg(): SVGSVGElement {
  const arc = (d: string): SVGPathElement => svgEl('path', { class: cls(ID, 'print'), d });
  return svgRoot(
    svgEl('circle', { class: cls(ID, 'track'), cx: 50, cy: 50, r: 44 }),
    svgEl('circle', {
      class: cls(ID, 'bar'),
      cx: 50,
      cy: 50,
      r: 44,
      pathLength: 100,
      transform: 'rotate(-90 50 50)',
    }),
    arc('M34 60 A16 16 0 0 1 66 60'),
    arc('M40 66 A10 10 0 0 1 60 66'),
    arc('M46 72 A4 4 0 0 1 54 72'),
    arc('M30 52 A20 20 0 0 1 70 52'),
  );
}
