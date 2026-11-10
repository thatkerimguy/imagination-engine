import type { MaterialDef, MaterialDomain, MaterialNode, MaterialValue } from '@ie/story';
import {
  availableIn,
  HELPERS,
  NODES,
  nodeInputs,
  type InputPort,
  type PortType,
} from './nodes.ts';

/** What went wrong in a graph, for the Studio to show on the node (and port) it belongs to. */
export type MaterialProblemCode =
  | 'no-output'
  | 'many-outputs'
  | 'cycle'
  | 'missing-link'
  | 'bad-port'
  | 'wrong-domain'
  | 'unknown-param'
  | 'offset-per-pixel';

export interface MaterialProblem {
  readonly code: MaterialProblemCode;
  readonly node?: string;
  readonly port?: string;
}

/**
 * GLSL chunks for the stage to wrap (ADR 0020). `fragment` sets `m_color` (vec3) and `m_alpha`
 * (float) and may read `m_uv` and, for text, `m_shape`. `vertex` (text only) sets `m_offset`
 * (vec2, CSS px). Both read the uniforms in `UNIFORMS`.
 */
export interface CompiledMaterial {
  readonly id: string;
  readonly domain: MaterialDomain;
  readonly helpers: string;
  readonly vertex: string;
  readonly fragment: string;
  /** Parameter ids in uniform order: `u_params[i]`. */
  readonly params: readonly string[];
  readonly problems: readonly MaterialProblem[];
  /** Everything that goes into the program; equal keys mean the same program. */
  readonly key: string;
}

const SIZE: Readonly<Record<PortType, number>> = { float: 1, vec2: 2, vec3: 3 };

/** A finite GLSL float literal ("1.0", "-0.25"). */
export function glslFloat(n: number): string {
  if (!Number.isFinite(n)) return '0.0';
  const rounded = Math.round(n * 1e6) / 1e6;
  const s = String(rounded);
  if (s.includes('e')) return rounded.toFixed(6);
  return s.includes('.') ? s : `${s}.0`;
}

function valueType(value: MaterialValue): PortType {
  if (typeof value === 'number') return 'float';
  return value.length >= 3 ? 'vec3' : 'vec2';
}

function literal(value: MaterialValue, type: PortType): string {
  const parts = typeof value === 'number' ? [value] : [...value];
  if (type === 'float') return glslFloat(parts[0] ?? 0);
  const n = SIZE[type];
  const filled = parts.length === 1 ? Array<number>(n).fill(parts[0] ?? 0) : parts;
  const list = Array.from({ length: n }, (_, i) => glslFloat(filled[i] ?? 0));
  return `${type}(${list.join(', ')})`;
}

/** Converts between float, vec2 and vec3: a float spreads, a vector is cut or padded with zeros. */
export function convert(expr: string, from: PortType, to: PortType): string {
  if (from === to) return expr;
  if (from === 'float') return `${to}(${expr})`;
  if (to === 'float') return `(${expr}).x`;
  return to === 'vec3' ? `vec3(${expr}, 0.0)` : `(${expr}).xy`;
}

interface Value {
  readonly expr: string;
  readonly type: PortType;
}

/** One shader stage's worth of generated statements. */
class Pass {
  readonly lines: string[] = [];
  readonly helpers = new Set<keyof typeof HELPERS>();
  private readonly memo = new Map<string, readonly Value[]>();
  private readonly visiting = new Set<string>();

  constructor(
    private readonly stage: 'vertex' | 'fragment',
    private readonly graph: Graph,
  ) {}

  /** The value an input reads: its link when that resolves, else the node's value or default. */
  input(node: MaterialNode, port: InputPort): Value {
    const link = node.inputs?.[port.name];
    if (link) {
      const linked = this.output(link.node, link.port);
      if (linked) return linked;
    }
    const value = node.values?.[port.name] ?? port.default;
    const type = port.type === 'any' ? valueType(value) : port.type;
    return { expr: literal(value, type), type };
  }

  /** A node's output, evaluated once per pass; null when it can't be used here. */
  output(nodeId: string, port?: string): Value | null {
    const node = this.graph.nodes.get(nodeId);
    if (!node || node.type === 'output') return null;
    const spec = NODES[node.type];
    if (!availableIn(node.type, this.graph.domain)) return null;
    if (this.stage === 'vertex' && spec.rate === 'pixel') {
      this.graph.report({ code: 'offset-per-pixel', node: node.id });
      return null;
    }
    const values = this.memo.get(node.id) ?? this.evaluate(node);
    if (!values) return null;
    const index = port ? spec.outputs.findIndex((o) => o.name === port) : 0;
    return values[index] ?? null;
  }

  private evaluate(node: MaterialNode): readonly Value[] | null {
    if (this.visiting.has(node.id)) {
      this.graph.report({ code: 'cycle', node: node.id });
      return null;
    }
    this.visiting.add(node.id);
    const spec = NODES[node.type];
    const args = spec.inputs.map((port) => ({ port, value: this.input(node, port) }));
    // The working type: the widest of the `any` inputs.
    let type: PortType = 'float';
    for (const { port, value } of args)
      if (port.type === 'any' && SIZE[value.type] > SIZE[type]) type = value.type;
    const exprs = args.map(({ port, value }) =>
      convert(value.expr, value.type, port.type === 'any' ? type : port.type),
    );
    if (spec.helper) this.helpers.add(spec.helper);
    const results = spec.emit(exprs, {
      stage: this.stage,
      type,
      literal: (name, t, fallback) => literal(node.values?.[name] ?? fallback, t),
      param: node.param ? (this.graph.paramIndex.get(node.param) ?? -1) : -1,
    });
    const k = this.graph.order.get(node.id) ?? 0;
    const values = spec.outputs.map((o, i): Value => {
      const t = o.type === 'same' ? type : o.type;
      const name = `n${k}_${i}`;
      this.lines.push(`  ${t} ${name} = ${results[i] ?? literal(0, t)};`);
      return { expr: name, type: t };
    });
    this.visiting.delete(node.id);
    this.memo.set(node.id, values);
    return values;
  }
}

interface Graph {
  readonly domain: MaterialDomain;
  readonly nodes: ReadonlyMap<string, MaterialNode>;
  readonly order: ReadonlyMap<string, number>;
  readonly paramIndex: ReadonlyMap<string, number>;
  readonly report: (problem: MaterialProblem) => void;
}

/** Checks links, domains and parameters; the passes then skip what was reported here. */
function checkNodes(def: MaterialDef, graph: Graph): void {
  for (const node of def.nodes) {
    if (!availableIn(node.type, def.domain)) graph.report({ code: 'wrong-domain', node: node.id });
    if (node.type === 'param' && !(node.param && graph.paramIndex.has(node.param)))
      graph.report({ code: 'unknown-param', node: node.id });
    const ports = nodeInputs(node.type, def.domain);
    for (const [name, link] of Object.entries(node.inputs ?? {})) {
      const source = graph.nodes.get(link.node);
      if (!ports.some((p) => p.name === name) || !source) {
        graph.report({ code: 'missing-link', node: node.id, port: name });
        continue;
      }
      const outputs = NODES[source.type].outputs;
      if (link.port ? !outputs.some((o) => o.name === link.port) : outputs.length === 0)
        graph.report({ code: 'bad-port', node: node.id, port: name });
    }
  }
}

/** Compiles a material graph to GLSL chunks (ADR 0020). Never throws: problems say what was cut. */
export function compileMaterial(def: MaterialDef): CompiledMaterial {
  const problems: MaterialProblem[] = [];
  const seen = new Set<string>();
  const report = (p: MaterialProblem) => {
    const key = `${p.code}:${p.node ?? ''}:${p.port ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    problems.push(p);
  };
  const graph: Graph = {
    domain: def.domain,
    nodes: new Map(def.nodes.map((n) => [n.id, n])),
    order: new Map(def.nodes.map((n, i) => [n.id, i])),
    paramIndex: new Map(def.params.map((p, i) => [p.id, i])),
    report,
  };
  checkNodes(def, graph);
  const outputs = def.nodes.filter((n) => n.type === 'output');
  if (outputs.length === 0) report({ code: 'no-output' });
  for (const extra of outputs.slice(1)) report({ code: 'many-outputs', node: extra.id });
  const output = outputs[0];
  const text = def.domain === 'text';
  const [colorPort, alphaPort, offsetPort] = NODES.output.inputs;

  const fragment = new Pass('fragment', graph);
  const pick = (port: InputPort | undefined, fallback: string, type: PortType): string => {
    if (!port || !output) return fallback;
    const linked = output.inputs?.[port.name];
    if (!linked && output.values?.[port.name] === undefined) return fallback;
    const value = fragment.input(output, port);
    return convert(value.expr, value.type, type);
  };
  const color = pick(colorPort, text ? 'v_color.rgb' : 'vec3(1.0)', 'vec3');
  const alpha = pick(alphaPort, text ? 'm_shape' : '1.0', 'float');
  fragment.lines.push(`  m_color = ${color};`, `  m_alpha = ${alpha};`);

  const vertex = new Pass('vertex', graph);
  if (text && output && offsetPort) {
    const value = vertex.input(output, offsetPort);
    vertex.lines.push(`  m_offset = ${convert(value.expr, value.type, 'vec2')};`);
  }

  const used = new Set([...fragment.helpers, ...vertex.helpers]);
  const helpers = (Object.keys(HELPERS) as (keyof typeof HELPERS)[])
    .filter((h) => used.has(h))
    .map((h) => HELPERS[h])
    .join('\n');
  const vertexBody = vertex.lines.join('\n');
  const fragmentBody = fragment.lines.join('\n');
  return {
    id: def.id,
    domain: def.domain,
    helpers,
    vertex: vertexBody,
    fragment: fragmentBody,
    params: def.params.map((p) => p.id),
    problems,
    key: `${def.domain}\n${helpers}\n//v\n${vertexBody}\n//f\n${fragmentBody}`,
  };
}
