import { z } from 'zod';

/*
 * Materials (ADR 0020): node graphs that @ie/material compiles to GLSL for the stage. Data only.
 * Links live on the input side: each input names the node and output port it reads.
 */

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'IDs use letters, digits and _');
const label = z.object({ en: z.string().optional(), tr: z.string().optional() });

export const MATERIAL_DOMAINS = ['text', 'post'] as const;
export type MaterialDomain = (typeof MATERIAL_DOMAINS)[number];

/** Every node type. @ie/material gives each its ports and GLSL; the two lists must match. */
export const MATERIAL_NODE_TYPES = [
  // Inputs
  'time',
  'beat',
  'beatPhase',
  'barPhase',
  'pulse',
  'uv',
  'aspect',
  'param',
  'number',
  'vector',
  'color',
  'glyphIndex',
  'glyphCount',
  'shape',
  'ink',
  // Math
  'add',
  'subtract',
  'multiply',
  'divide',
  'oneMinus',
  'abs',
  'fract',
  'floor',
  'sin',
  'cos',
  'power',
  'min',
  'max',
  'clamp',
  'mix',
  'step',
  'smoothstep',
  // Vectors
  'length',
  'distance',
  'dot',
  'split',
  'combine',
  // Patterns and colour
  'noise',
  'hsv',
  // The one output
  'output',
] as const;
export type MaterialNodeType = (typeof MATERIAL_NODE_TYPES)[number];

export const MATERIAL_LIMITS = {
  nodes: 64,
  params: 8,
  /** Seconds a parameter ramp may take. */
  rampSeconds: 30,
  /** Canvas size in Studio units, so a node can't be lost far away. */
  canvas: 4000,
} as const;

/** A number, or a vector of two or three numbers (an unlinked input's value). */
export type MaterialValue = number | readonly number[];
const valueSchema = z.union([z.number(), z.array(z.number()).min(2).max(3)]);

export interface MaterialLink {
  readonly node: string;
  /** The output port; a node with one output can leave it out. */
  readonly port?: string;
}

export interface MaterialNode {
  readonly id: string;
  readonly type: MaterialNodeType;
  readonly x: number;
  readonly y: number;
  /** Values of inputs that have no link (and of constant nodes). */
  readonly values?: Readonly<Record<string, MaterialValue>>;
  readonly inputs?: Readonly<Record<string, MaterialLink>>;
  /** The parameter a `param` node reads. */
  readonly param?: string;
}
const coord = z.number().min(0).max(MATERIAL_LIMITS.canvas);
export const materialNodeSchema = z.object({
  id,
  type: z.enum(MATERIAL_NODE_TYPES),
  x: coord,
  y: coord,
  values: z.record(z.string(), valueSchema).optional(),
  inputs: z.record(z.string(), z.object({ node: id, port: z.string().optional() })).optional(),
  param: id.optional(),
});

/** A number the sequencer can set or ramp (`stage.material.param`). */
export interface MaterialParam {
  readonly id: string;
  readonly name: { readonly en?: string; readonly tr?: string };
  readonly default: number;
  readonly min: number;
  readonly max: number;
}
export const materialParamSchema = z
  .object({
    id,
    name: label,
    default: z.number(),
    min: z.number(),
    max: z.number(),
  })
  .refine((p) => p.min <= p.max && p.default >= p.min && p.default <= p.max, {
    message: 'A parameter needs min ≤ default ≤ max.',
  });

export interface MaterialDef {
  readonly id: string;
  readonly name: { readonly en?: string; readonly tr?: string };
  readonly domain: MaterialDomain;
  readonly nodes: readonly MaterialNode[];
  readonly params: readonly MaterialParam[];
}
export const materialSchema = z.object({
  id,
  name: label,
  domain: z.enum(MATERIAL_DOMAINS),
  nodes: z.array(materialNodeSchema).max(MATERIAL_LIMITS.nodes),
  params: z.array(materialParamSchema).max(MATERIAL_LIMITS.params),
});

/** The material a project names, if it exists and is of `domain`. */
export function findMaterial(
  materials: readonly MaterialDef[] | undefined,
  materialId: string | undefined,
  domain?: MaterialDomain,
): MaterialDef | undefined {
  if (!materialId) return undefined;
  const found = materials?.find((m) => m.id === materialId);
  return found && (!domain || found.domain === domain) ? found : undefined;
}
