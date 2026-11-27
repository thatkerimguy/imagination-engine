// Modular SVG ornament layers for the 8 `ornament.grammar` styles. Pure vector paths built with
// createElementNS (zero innerHTML, zero assets) in `currentColor`, so they inherit the accent.
// Corners are drawn once (top-left, 24-unit box) and mirrored into the other three corners by
// nested <svg> anchors at 0% / 100%, so the layer fits any card size without distortion.
import type { OrnamentGrammar } from '@kn/core/dna';
import { svgEl } from './dom-safe.ts';

interface Recipe {
  /** Top-left corner path in a 24×24 box (mirrored to all four corners). */
  corner?: string;
  /** Horizontal rules: y offsets in px from the top (negative = from the bottom). */
  rules?: number[];
  /** Extra decorations. */
  extra?: (root: SVGSVGElement, stroke: number) => void;
}

let patternSeq = 0;

function anchor(x: string, y: string, sx: number, sy: number, d: string): SVGSVGElement {
  const g = svgEl('g', { transform: `scale(${sx} ${sy})` }, svgEl('path', { d }));
  return svgEl('svg', { x, y, width: '1', height: '1', overflow: 'visible' }, g);
}

function rule(y: number, dashed = false): SVGLineElement {
  // Bottom rules sit at 100% and are lifted by a transform (SVG attributes cannot use calc()).
  const yy = y >= 0 ? String(y) : '100%';
  const line = svgEl('line', { x1: '6%', x2: '94%', y1: yy, y2: yy });
  if (y < 0) line.setAttribute('transform', `translate(0 ${y})`);
  if (dashed) line.setAttribute('stroke-dasharray', '4 4');
  return line;
}

const RECIPES: Record<OrnamentGrammar, Recipe> = {
  minimal: { rules: [1] },
  'cyber-brackets': {
    corner: 'M1 13V1h12M5 1v3M1 5h3',
    extra: (root) => {
      root.append(
        svgEl('line', { x1: '0', x2: '0', y1: '45%', y2: '55%', 'stroke-width': '3' }),
        anchor('100%', '45%', -1, 1, 'M0 0v10'),
      );
    },
  },
  'deco-corners': { corner: 'M1 20V1h19M5 15V5h10M9 9h2v2H9z', rules: [-6] },
  'parchment-filigree': {
    corner: 'M1 17C1 8 8 1 17 1M4 22c0-7 6-13 13-13M9 6l2-2 2 2-2 2z',
  },
  'dossier-stamp': {
    corner: 'M7 3h10M7 6h10',
    extra: (root) => {
      const tab = anchor('100%', '0', 1, 1, 'M-70 0v16h58V0M-62 8h42');
      tab.setAttribute('class', 'kn-e-orn-tab');
      root.append(tab);
    },
  },
  'rune-notch': { corner: 'M1 20V9l8-8h11M5 11v4M11 5h4' },
  // Beveled 45° sci-fi corner cuts plus small registration ticks: structurally distinct from the
  // open L of `cyber-brackets` (Holographic System vs Noir Rain).
  'chamfer-tech': {
    corner: 'M1 22V9l8-8h13M4 13l9-9M18 4h3M4 18v3',
    extra: (root) => {
      root.append(
        svgEl('line', { x1: '50%', x2: '50%', y1: '0', y2: '4', transform: 'translate(-6 0)' }),
        svgEl('line', { x1: '50%', x2: '50%', y1: '0', y2: '4', transform: 'translate(6 0)' }),
        anchor('50%', '100%', 1, -1, 'M-6 0v4M6 0v4'),
      );
    },
  },
  'torn-edge': {
    extra: (root, stroke) => {
      const id = `kn-e-deckle-${++patternSeq}`;
      const pattern = svgEl(
        'pattern',
        { id, width: '18', height: '6', patternUnits: 'userSpaceOnUse' },
        svgEl('path', { d: 'M0 3l3-2 3 3 4-3 3 2 5-1', 'stroke-width': String(stroke) }),
      );
      root.append(
        svgEl('defs', {}, pattern),
        svgEl('rect', { x: '0', y: '0', width: '100%', height: '6', fill: `url(#${id})` }),
        svgEl('rect', {
          x: '0',
          y: '100%',
          width: '100%',
          height: '6',
          fill: `url(#${id})`,
          transform: 'translate(0 -6)',
        }),
      );
    },
  },
};

/**
 * An `inset: 0` decorative layer for a card: `pointer-events: none`, `aria-hidden`, strokes in
 * `currentColor` (set `color` on the card or rely on `--kn-e-accent` / `--dna-accent`).
 */
export function createOrnamentLayer(grammar: OrnamentGrammar, strokeWidth = 1.5): SVGSVGElement {
  const recipe = RECIPES[grammar];
  const root = svgEl('svg', {
    class: `kn-e-orn kn-e-orn--${grammar}`,
    'aria-hidden': 'true',
    focusable: 'false',
    width: '100%',
    height: '100%',
    overflow: 'visible',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': String(strokeWidth),
    'stroke-linecap': 'square',
  });
  root.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;' +
    'color:var(--kn-e-accent,var(--dna-accent,currentColor))';
  if (recipe.corner) {
    const d = recipe.corner;
    root.append(
      anchor('0', '0', 1, 1, d),
      anchor('100%', '0', -1, 1, d),
      anchor('0', '100%', 1, -1, d),
      anchor('100%', '100%', -1, -1, d),
    );
  }
  for (const y of recipe.rules ?? []) root.append(rule(y, grammar === 'minimal'));
  recipe.extra?.(root, strokeWidth);
  return root;
}
