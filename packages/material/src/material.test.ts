import { materialSchema, MATERIAL_NODE_TYPES, type MaterialDef } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { compileMaterial, convert, glslFloat } from './compile.ts';
import { NODES } from './nodes.ts';
import { materialTemplate } from './templates.ts';

let counter = 0;
const makeId = (prefix: string) => `${prefix}${++counter}`;

const post = (nodes: MaterialDef['nodes'], params: MaterialDef['params'] = []): MaterialDef => ({
  id: 'm',
  name: { en: 'M' },
  domain: 'post',
  nodes,
  params,
});

/** Every `nK_I` a body uses is declared before it (catches ordering bugs without a GPU). */
function declaredBeforeUse(body: string): boolean {
  const declared = new Set<string>();
  for (const line of body.split('\n')) {
    const decl = /^\s*(?:float|vec2|vec3) (n\d+_\d+) =/.exec(line);
    const used = line.slice(decl ? decl[0].length : 0).match(/n\d+_\d+/g) ?? [];
    if (used.some((u) => !declared.has(u))) return false;
    if (decl?.[1]) declared.add(decl[1]);
  }
  return true;
}

describe('the node table', () => {
  it('covers every node type the schema allows', () => {
    expect(Object.keys(NODES).sort()).toEqual([...MATERIAL_NODE_TYPES].sort());
  });
});

describe('GLSL helpers', () => {
  it('writes floats GLSL accepts', () => {
    expect(glslFloat(1)).toBe('1.0');
    expect(glslFloat(-0.25)).toBe('-0.25');
    expect(glslFloat(1e-7)).toBe('0.0');
    expect(glslFloat(Number.NaN)).toBe('0.0');
  });

  it('converts between floats and vectors', () => {
    expect(convert('a', 'float', 'vec3')).toBe('vec3(a)');
    expect(convert('a', 'vec2', 'vec3')).toBe('vec3(a, 0.0)');
    expect(convert('a', 'vec3', 'vec2')).toBe('(a).xy');
    expect(convert('a', 'vec2', 'float')).toBe('(a).x');
  });
});

describe('compileMaterial', () => {
  it('compiles the starter graphs cleanly, and they pass the schema', () => {
    for (const domain of ['text', 'post'] as const) {
      const def = materialTemplate(domain, { en: 'T' }, makeId);
      expect(materialSchema.safeParse(def).success).toBe(true);
      const compiled = compileMaterial(def);
      expect(compiled.problems).toEqual([]);
      expect(declaredBeforeUse(compiled.fragment)).toBe(true);
      expect(declaredBeforeUse(compiled.vertex)).toBe(true);
      expect(compiled.params).toHaveLength(def.params.length);
    }
  });

  it('evaluates a shared node once and widens mixed types', () => {
    const compiled = compileMaterial(
      post([
        { id: 'uv', type: 'uv', x: 0, y: 0 },
        { id: 't', type: 'time', x: 0, y: 0 },
        { id: 'sum', type: 'add', x: 0, y: 0, inputs: { a: { node: 'uv' }, b: { node: 't' } } },
        {
          id: 'o',
          type: 'output',
          x: 0,
          y: 0,
          inputs: { color: { node: 'sum' }, alpha: { node: 'sum' } },
        },
      ]),
    );
    expect(compiled.problems).toEqual([]);
    expect(compiled.fragment.match(/vec2 n2_0 = \(n0_0 \+ vec2\(n1_0\)\);/g)).toHaveLength(1);
    expect(compiled.fragment).toContain('m_color = vec3(n2_0, 0.0);');
    expect(compiled.fragment).toContain('m_alpha = (n2_0).x;');
  });

  it('uses node values for unlinked inputs, and output defaults per domain', () => {
    const compiled = compileMaterial(
      post([
        { id: 'k', type: 'number', x: 0, y: 0, values: { value: 0.3 } },
        { id: 'o', type: 'output', x: 0, y: 0, inputs: { alpha: { node: 'k' } } },
      ]),
    );
    expect(compiled.fragment).toContain('float n0_0 = 0.3;');
    expect(compiled.fragment).toContain('m_color = vec3(1.0);');
    const text = compileMaterial({
      ...post([{ id: 'o', type: 'output', x: 0, y: 0 }]),
      domain: 'text',
    });
    expect(text.fragment).toContain('m_color = v_color.rgb;');
    expect(text.fragment).toContain('m_alpha = m_shape;');
    expect(text.vertex).toContain('m_offset = vec2(0.0, 0.0);');
  });

  it('reads parameters from their uniform slot', () => {
    const compiled = compileMaterial(
      post(
        [
          { id: 'p', type: 'param', x: 0, y: 0, param: 'b' },
          { id: 'o', type: 'output', x: 0, y: 0, inputs: { alpha: { node: 'p' } } },
        ],
        [
          { id: 'a', name: {}, default: 0, min: 0, max: 1 },
          { id: 'b', name: {}, default: 0, min: 0, max: 1 },
        ],
      ),
    );
    expect(compiled.fragment).toContain('float n0_0 = u_params[1];');
    expect(compiled.params).toEqual(['a', 'b']);
  });

  it('cuts cycles and reports broken links without throwing', () => {
    const compiled = compileMaterial(
      post([
        { id: 'a', type: 'sin', x: 0, y: 0, inputs: { x: { node: 'b' } } },
        { id: 'b', type: 'cos', x: 0, y: 0, inputs: { x: { node: 'a' } } },
        { id: 'c', type: 'abs', x: 0, y: 0, inputs: { x: { node: 'gone' } } },
        { id: 'd', type: 'abs', x: 0, y: 0, inputs: { x: { node: 'combine', port: 'nope' } } },
        { id: 'combine', type: 'combine', x: 0, y: 0 },
        { id: 'p', type: 'param', x: 0, y: 0, param: 'missing' },
        { id: 'g', type: 'shape', x: 0, y: 0 },
        { id: 'o', type: 'output', x: 0, y: 0, inputs: { alpha: { node: 'a' } } },
        { id: 'o2', type: 'output', x: 0, y: 0 },
      ]),
    );
    const codes = compiled.problems.map((p) => `${p.code}:${p.node ?? ''}`);
    expect(codes).toEqual(
      expect.arrayContaining([
        'cycle:a',
        'missing-link:c',
        'bad-port:d',
        'unknown-param:p',
        'wrong-domain:g',
        'many-outputs:o2',
      ]),
    );
    expect(declaredBeforeUse(compiled.fragment)).toBe(true);
  });

  it('keeps per-pixel inputs out of the vertex offset', () => {
    const compiled = compileMaterial({
      ...post([
        { id: 'uv', type: 'uv', x: 0, y: 0 },
        { id: 'o', type: 'output', x: 0, y: 0, inputs: { offset: { node: 'uv' } } },
      ]),
      domain: 'text',
    });
    expect(compiled.problems).toEqual([{ code: 'offset-per-pixel', node: 'uv' }]);
    expect(compiled.vertex).not.toContain('m_uv');
  });

  it('reports a graph with no output, and only adds helpers it uses', () => {
    expect(compileMaterial(post([])).problems).toEqual([{ code: 'no-output' }]);
    const plain = compileMaterial(post([{ id: 'o', type: 'output', x: 0, y: 0 }]));
    expect(plain.helpers).toBe('');
    const noisy = compileMaterial(
      post([
        { id: 'n', type: 'noise', x: 0, y: 0 },
        { id: 'o', type: 'output', x: 0, y: 0, inputs: { alpha: { node: 'n' } } },
      ]),
    );
    expect(noisy.helpers).toContain('m_noise');
    expect(noisy.key).not.toBe(plain.key);
  });
});
