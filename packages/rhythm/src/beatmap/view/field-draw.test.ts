import type { BeatmapDef } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { prepareObjects } from '../prepare.ts';
import { playRules } from '../rules.ts';
import { FieldPainter } from './field-draw.ts';
import { fitField, type FieldPalette } from './field-layout.ts';

/** A canvas context that only counts the circles drawn. */
function fakeContext(): { ctx: CanvasRenderingContext2D; arcs: () => number } {
  let arcs = 0;
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => (key === 'arc' ? () => arcs++ : () => undefined),
      set: () => true,
    },
  ) as CanvasRenderingContext2D;
  return { ctx, arcs: () => arcs };
}

const palette = new Proxy({}, { get: () => '#000' }) as FieldPalette;

const map: BeatmapDef = {
  id: 'bm1',
  name: { en: 'Test' },
  difficulty: { size: 4, approach: 5, accuracy: 5, drain: 5 },
  timing: [{ t: 0, bpm: 120 }],
  objects: [
    { id: 'a', kind: 'circle', t: 3000, x: 0.3, y: 0.3 },
    { id: 'b', kind: 'circle', t: 3500, x: 0.6, y: 0.3 },
  ],
};

describe('field painter', () => {
  const rules = playRules(map.difficulty);
  const objects = prepareObjects(map, rules);
  const layout = fitField(800, 600, 1, { top: 0, bottom: 0, pad: 0.05, allowRotate: false });

  it('draws nothing (and does not fail) before the first note appears', () => {
    const { ctx, arcs } = fakeContext();
    expect(() => new FieldPainter(ctx, palette).draw(layout, objects, { t: 0, rules })).not.toThrow();
    expect(arcs()).toBe(0);
  });

  it('draws a note and its approach ring once it appears', () => {
    const { ctx, arcs } = fakeContext();
    new FieldPainter(ctx, palette).draw(layout, objects, { t: 2800, rules });
    expect(arcs()).toBeGreaterThanOrEqual(2);
  });
});
