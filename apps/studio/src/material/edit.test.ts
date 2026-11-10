import { compileMaterial } from '@ie/material';
import { materialSchema } from '@ie/story';
import { describe, expect, it } from 'vitest';
import {
  addNode,
  addParam,
  dependsOn,
  link,
  moveNode,
  newMaterial,
  removeNode,
  removeParam,
  setValue,
  unlink,
  updateParam,
} from './edit.ts';
import { canvasSize, portPoint, nodePorts } from './layout.ts';

const fresh = () => newMaterial('post', { en: 'Glow', tr: 'Parıltı' });

describe('material edits', () => {
  it('starts from a working graph', () => {
    const m = fresh();
    expect(materialSchema.safeParse(m).success).toBe(true);
    expect(compileMaterial(m).problems).toEqual([]);
  });

  it('adds, moves and removes nodes, dropping links to a removed one', () => {
    let m = fresh();
    const added = addNode(m, 'time', 5000, -20);
    m = added.material;
    const id = added.id ?? '';
    expect(m.nodes.find((n) => n.id === id)).toMatchObject({ x: 4000, y: 0 });
    const out = m.nodes.find((n) => n.type === 'output');
    m = link(m, { node: id, port: 'out' }, { node: out?.id ?? '', port: 'alpha' });
    expect(m.nodes.find((n) => n.type === 'output')?.inputs?.alpha).toEqual({
      node: id,
      port: 'out',
    });
    m = moveNode(m, id, 100, 120);
    expect(m.nodes.find((n) => n.id === id)).toMatchObject({ x: 100, y: 120 });
    m = removeNode(m, id);
    expect(m.nodes.some((n) => n.id === id)).toBe(false);
    expect(m.nodes.find((n) => n.type === 'output')?.inputs?.alpha).toBeUndefined();
    // The output node can't be removed, and there is only ever one.
    expect(removeNode(m, out?.id ?? '')).toBe(m);
    expect(addNode(m, 'output', 0, 0).id).toBeNull();
  });

  it('refuses links that would make a loop', () => {
    let m = fresh();
    const a = addNode(m, 'sin', 0, 0);
    m = a.material;
    const b = addNode(m, 'cos', 0, 0);
    m = b.material;
    const [ai, bi] = [a.id ?? '', b.id ?? ''];
    m = link(m, { node: ai, port: 'out' }, { node: bi, port: 'x' });
    expect(dependsOn(m, bi, ai)).toBe(true);
    expect(link(m, { node: bi, port: 'out' }, { node: ai, port: 'x' })).toBe(m);
    expect(link(m, { node: ai, port: 'out' }, { node: ai, port: 'x' })).toBe(m);
    m = unlink(m, bi, 'x');
    expect(dependsOn(m, bi, ai)).toBe(false);
  });

  it('sets values and keeps parameters in range', () => {
    let m = fresh();
    const n = addNode(m, 'number', 0, 0);
    m = setValue(n.material, n.id ?? '', 'value', 0.25);
    expect(m.nodes.find((x) => x.id === n.id)?.values).toEqual({ value: 0.25 });
    const p = addParam(m, { en: 'Speed', tr: 'Hız' });
    m = updateParam(p.material, p.id ?? '', { min: 2, max: 1 });
    expect(m.params.find((x) => x.id === p.id)).toMatchObject({ min: 1, max: 2, default: 1 });
    const reader = addNode(m, 'param', 0, 0);
    m = removeParam(reader.material, m.params[0]?.id ?? '');
    expect(m.nodes.find((x) => x.id === reader.id)?.param).toBeUndefined();
  });

  it('lays ports out from the data', () => {
    const m = fresh();
    const out = m.nodes.find((n) => n.type === 'output');
    if (!out) throw new Error('no output');
    const ports = nodePorts(out, m.domain);
    expect(ports.inputs.map((p) => p.name)).toEqual(['color', 'alpha']);
    const color = portPoint(out, ports, 'in', 'color');
    const alpha = portPoint(out, ports, 'in', 'alpha');
    expect(color.x).toBe(out.x);
    expect(alpha.y).toBeGreaterThan(color.y);
    expect(canvasSize(m).w).toBeGreaterThan(out.x);
  });
});
