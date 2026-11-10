import { compileMaterial } from '@ie/material';
import type { MaterialDef } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { StageMaterials } from './materials.ts';

const def = (params: MaterialDef['params']): MaterialDef => ({
  id: 'glow',
  name: { en: 'Glow' },
  domain: 'post',
  nodes: [{ id: 'o', type: 'output', x: 0, y: 0 }],
  params,
});
const amount = { id: 'amount', name: {}, default: 0.5, min: 0, max: 1 };
const speed = { id: 'speed', name: {}, default: 2, min: 0, max: 10 };

describe('StageMaterials', () => {
  it('starts parameters at their defaults and clamps what is set', () => {
    const m = new StageMaterials();
    const d = def([amount, speed]);
    m.use(compileMaterial(d), d.params);
    m.setPost('glow');
    const entry = m.postEntry;
    expect(entry?.values[0]).toBe(0.5);
    expect(entry?.values[1]).toBe(2);
    m.setParam('glow', 'speed', 50);
    expect(entry?.values[1]).toBe(10);
    expect(m.get('glow', 'text')).toBeUndefined();
  });

  it('ramps a parameter over its seconds and then stops animating', () => {
    const m = new StageMaterials();
    const d = def([amount]);
    m.use(compileMaterial(d), d.params);
    m.setParam('glow', 'amount', 0, 1, 2);
    expect(m.animating).toBe(true);
    m.update(1);
    expect(m.get('glow', 'post')?.values[0]).toBeCloseTo(0.5);
    m.update(5);
    expect(m.get('glow', 'post')?.values[0]).toBe(1);
    expect(m.animating).toBe(false);
  });

  it('keeps live values across an edit, and resets them after a load', () => {
    const m = new StageMaterials();
    const d = def([amount]);
    m.use(compileMaterial(d), d.params);
    m.setParam('glow', 'amount', 0.9);
    const edited = def([speed, amount]);
    m.use(compileMaterial(edited), edited.params);
    expect(m.get('glow', 'post')?.values[1]).toBeCloseTo(0.9);
    m.setParam('glow', 'speed', 0, 5, 1);
    m.reset();
    expect(m.get('glow', 'post')?.values[1]).toBe(0.5);
    expect(m.animating).toBe(false);
  });
});
