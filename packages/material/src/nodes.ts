import type { MaterialDomain, MaterialNodeType } from '@ie/story';

/** GLSL value types a port can carry. `any` takes the widest type of the node's `any` inputs. */
export type PortType = 'float' | 'vec2' | 'vec3';
export type InputType = PortType | 'any';

export interface InputPort {
  readonly name: string;
  readonly type: InputType;
  /** Used when nothing is linked and the node stores no value. */
  readonly default: number | readonly number[];
}

export interface OutputPort {
  readonly name: string;
  /** `same` is the node's working type (from its `any` inputs). */
  readonly type: PortType | 'same';
}

/** Where a value can be worked out: per pixel only, or per glyph too (the vertex shader). */
export type Rate = 'pixel' | 'any';

export interface NodeSpec {
  readonly group: 'input' | 'math' | 'vector' | 'pattern' | 'output';
  readonly inputs: readonly InputPort[];
  readonly outputs: readonly OutputPort[];
  /** Domains it exists in; all when absent. */
  readonly domains?: readonly MaterialDomain[];
  /** `pixel` for inputs that only exist per pixel (UV, a glyph's shape). */
  readonly rate?: Rate;
  /** A GLSL helper it needs (see HELPERS). */
  readonly helper?: keyof typeof HELPERS;
  /**
   * GLSL for each output, from the input expressions (already converted to their port types) and
   * the node's working type. `stage` lets inputs read the right variable in each shader.
   */
  readonly emit: (a: readonly string[], ctx: EmitContext) => readonly string[];
}

export interface EmitContext {
  readonly stage: 'vertex' | 'fragment';
  readonly type: PortType;
  /** A literal from the node's own values (constants), already formatted for its type. */
  readonly literal: (name: string, type: PortType, fallback: number | readonly number[]) => string;
  /** The uniform slot of the node's parameter, or -1. */
  readonly param: number;
}

/** GLSL functions some nodes need, added to a shader only when used. */
export const HELPERS = {
  noise: /* glsl */ `float m_hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float m_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(m_hash(i), m_hash(i + vec2(1.0, 0.0)), u.x),
             mix(m_hash(i + vec2(0.0, 1.0)), m_hash(i + vec2(1.0, 1.0)), u.x), u.y);
}`,
  hsv: /* glsl */ `vec3 m_hsv(float h, float s, float v) {
  vec3 k = clamp(abs(fract(h + vec3(0.0, 2.0, 1.0) / 3.0) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), k, s);
}`,
} as const;

const out = (type: OutputPort['type'] = 'same', name = 'out'): OutputPort => ({ name, type });
const any = (name: string, value = 0): InputPort => ({ name, type: 'any', default: value });
const num = (name: string, value = 0): InputPort => ({ name, type: 'float', default: value });

function unary(fn: (x: string) => string): NodeSpec {
  return { group: 'math', inputs: [any('x')], outputs: [out()], emit: ([x = '0.0']) => [fn(x)] };
}
function binary(fn: (a: string, b: string) => string, a = 0, b = 0): NodeSpec {
  return {
    group: 'math',
    inputs: [any('a', a), any('b', b)],
    outputs: [out()],
    emit: ([x = '0.0', y = '0.0']) => [fn(x, y)],
  };
}
function uniform(name: string, rate: Rate = 'any', domains?: readonly MaterialDomain[]): NodeSpec {
  return {
    group: 'input',
    inputs: [],
    outputs: [out('float')],
    rate,
    ...(domains ? { domains } : {}),
    emit: () => [name],
  };
}

/** Uniforms every material program declares (the stage sets them each frame). */
export const UNIFORMS = {
  time: 'u_time',
  beat: 'u_beat',
  beatPhase: 'u_beatPhase',
  barPhase: 'u_barPhase',
  pulse: 'u_pulse',
  aspect: 'u_aspect',
  glyphCount: 'u_glyphCount',
  params: 'u_params',
} as const;

export const NODES: Readonly<Record<MaterialNodeType, NodeSpec>> = {
  time: uniform(UNIFORMS.time),
  beat: uniform(UNIFORMS.beat),
  beatPhase: uniform(UNIFORMS.beatPhase),
  barPhase: uniform(UNIFORMS.barPhase),
  pulse: uniform(UNIFORMS.pulse),
  aspect: uniform(UNIFORMS.aspect),
  glyphCount: uniform(UNIFORMS.glyphCount, 'any', ['text']),
  uv: { group: 'input', inputs: [], outputs: [out('vec2')], rate: 'pixel', emit: () => ['m_uv'] },
  param: {
    group: 'input',
    inputs: [],
    outputs: [out('float')],
    emit: (_, ctx) => [ctx.param >= 0 ? `${UNIFORMS.params}[${ctx.param}]` : '0.0'],
  },
  number: {
    group: 'input',
    inputs: [],
    outputs: [out('float')],
    emit: (_, ctx) => [ctx.literal('value', 'float', 1)],
  },
  vector: {
    group: 'input',
    inputs: [],
    outputs: [out('vec2')],
    emit: (_, ctx) => [ctx.literal('value', 'vec2', [0.5, 0.5])],
  },
  color: {
    group: 'input',
    inputs: [],
    outputs: [out('vec3')],
    emit: (_, ctx) => [ctx.literal('value', 'vec3', [1, 1, 1])],
  },
  glyphIndex: {
    group: 'input',
    inputs: [],
    outputs: [out('float')],
    domains: ['text'],
    emit: (_, ctx) => [ctx.stage === 'vertex' ? 'a_params.w' : 'v_params.w'],
  },
  shape: {
    group: 'input',
    inputs: [],
    outputs: [out('float')],
    domains: ['text'],
    rate: 'pixel',
    emit: () => ['m_shape'],
  },
  ink: {
    group: 'input',
    inputs: [],
    outputs: [out('vec3')],
    domains: ['text'],
    emit: (_, ctx) => [ctx.stage === 'vertex' ? 'a_color.rgb' : 'v_color.rgb'],
  },
  add: binary((a, b) => `(${a} + ${b})`),
  subtract: binary((a, b) => `(${a} - ${b})`),
  multiply: binary((a, b) => `(${a} * ${b})`, 1, 1),
  // Dividing by zero would put NaN on the screen; a tiny floor keeps it finite.
  divide: binary((a, b) => `(${a} / max(abs(${b}), 1e-4) * sign(${b} + 1e-9))`, 1, 1),
  oneMinus: unary((x) => `(1.0 - ${x})`),
  abs: unary((x) => `abs(${x})`),
  fract: unary((x) => `fract(${x})`),
  floor: unary((x) => `floor(${x})`),
  sin: unary((x) => `sin(${x})`),
  cos: unary((x) => `cos(${x})`),
  power: binary((a, b) => `pow(max(${a}, 0.0), ${b})`, 1, 2),
  min: binary((a, b) => `min(${a}, ${b})`),
  max: binary((a, b) => `max(${a}, ${b})`),
  clamp: {
    group: 'math',
    inputs: [any('x'), num('min', 0), num('max', 1)],
    outputs: [out()],
    emit: ([x = '0.0', lo = '0.0', hi = '1.0']) => [`clamp(${x}, ${lo}, ${hi})`],
  },
  mix: {
    group: 'math',
    inputs: [any('a', 0), any('b', 1), num('t', 0.5)],
    outputs: [out()],
    emit: ([a = '0.0', b = '1.0', t = '0.5']) => [`mix(${a}, ${b}, ${t})`],
  },
  step: {
    group: 'math',
    inputs: [num('edge', 0.5), any('x')],
    outputs: [out()],
    emit: ([e = '0.5', x = '0.0']) => [`step(${e}, ${x})`],
  },
  smoothstep: {
    group: 'math',
    inputs: [num('from', 0), num('to', 1), any('x')],
    outputs: [out()],
    emit: ([a = '0.0', b = '1.0', x = '0.0']) => [`smoothstep(${a}, ${b}, ${x})`],
  },
  length: {
    group: 'vector',
    inputs: [any('v')],
    outputs: [out('float')],
    emit: ([v = '0.0']) => [`length(${v})`],
  },
  distance: {
    group: 'vector',
    inputs: [any('a'), any('b')],
    outputs: [out('float')],
    emit: ([a = '0.0', b = '0.0']) => [`distance(${a}, ${b})`],
  },
  dot: {
    group: 'vector',
    inputs: [any('a'), any('b')],
    outputs: [out('float')],
    emit: ([a = '0.0', b = '0.0']) => [`dot(${a}, ${b})`],
  },
  split: {
    group: 'vector',
    inputs: [{ name: 'v', type: 'vec3', default: [0, 0, 0] }],
    outputs: [out('float', 'x'), out('float', 'y'), out('float', 'z')],
    emit: ([v = 'vec3(0.0)']) => [`${v}.x`, `${v}.y`, `${v}.z`],
  },
  combine: {
    group: 'vector',
    inputs: [num('x'), num('y'), num('z')],
    outputs: [out('vec3', 'xyz'), out('vec2', 'xy')],
    emit: ([x = '0.0', y = '0.0', z = '0.0']) => [`vec3(${x}, ${y}, ${z})`, `vec2(${x}, ${y})`],
  },
  noise: {
    group: 'pattern',
    inputs: [{ name: 'uv', type: 'vec2', default: [0, 0] }, num('scale', 8)],
    outputs: [out('float')],
    helper: 'noise',
    emit: ([p = 'vec2(0.0)', s = '8.0']) => [`m_noise(${p} * ${s})`],
  },
  hsv: {
    group: 'pattern',
    inputs: [num('hue', 0), num('saturation', 1), num('value', 1)],
    outputs: [out('vec3')],
    helper: 'hsv',
    emit: ([h = '0.0', s = '1.0', v = '1.0']) => [`m_hsv(${h}, ${s}, ${v})`],
  },
  output: {
    group: 'output',
    inputs: [
      { name: 'color', type: 'vec3', default: [1, 1, 1] },
      num('alpha', 1),
      { name: 'offset', type: 'vec2', default: [0, 0] },
    ],
    outputs: [],
    emit: () => [],
  },
};

/** The output node's inputs in a domain: text has an offset, post doesn't. */
export function outputInputs(domain: MaterialDomain): readonly InputPort[] {
  const all = NODES.output.inputs;
  return domain === 'text' ? all : all.filter((p) => p.name !== 'offset');
}

/** Ports a node shows in a domain (the output node differs per domain). */
export function nodeInputs(type: MaterialNodeType, domain: MaterialDomain): readonly InputPort[] {
  return type === 'output' ? outputInputs(domain) : NODES[type].inputs;
}

export function availableIn(type: MaterialNodeType, domain: MaterialDomain): boolean {
  const domains = NODES[type].domains;
  return !domains || domains.includes(domain);
}
