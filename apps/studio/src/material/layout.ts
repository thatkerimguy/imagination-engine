import { NODES, nodeInputs, type InputPort, type OutputPort } from '@ie/material';
import type { MaterialDef, MaterialNode } from '@ie/story';

/*
 * Where a node's ports sit on the canvas. Every node has the same width and row height, so wires
 * are drawn from the data alone, without measuring the DOM.
 */

export const NODE_W = 176;
export const HEAD = 32;
export const ROW = 30;

export interface NodePorts {
  readonly outputs: readonly OutputPort[];
  readonly inputs: readonly InputPort[];
}

export function nodePorts(node: MaterialNode, domain: MaterialDef['domain']): NodePorts {
  return { outputs: NODES[node.type].outputs, inputs: nodeInputs(node.type, domain) };
}

export function nodeHeight(ports: NodePorts): number {
  return HEAD + (ports.outputs.length + ports.inputs.length) * ROW + 8;
}

/** The centre of an output port (right edge) or input port (left edge), in canvas px. */
export function portPoint(
  node: MaterialNode,
  ports: NodePorts,
  side: 'out' | 'in',
  name: string,
): { x: number; y: number } {
  const outIndex = Math.max(
    0,
    ports.outputs.findIndex((o) => o.name === name),
  );
  const row =
    side === 'out'
      ? outIndex
      : ports.outputs.length +
        Math.max(
          0,
          ports.inputs.findIndex((i) => i.name === name),
        );
  return {
    x: node.x + (side === 'out' ? NODE_W : 0),
    y: node.y + HEAD + row * ROW + ROW / 2,
  };
}

/** A wire as a smooth curve from an output to an input. */
export function wirePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const bend = Math.max(40, Math.abs(b.x - a.x) / 2);
  return `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`;
}

/** The canvas size that holds every node, with room to drag past the last one. */
export function canvasSize(def: MaterialDef): { w: number; h: number } {
  let w = 640;
  let h = 480;
  for (const node of def.nodes) {
    w = Math.max(w, node.x + NODE_W + 240);
    h = Math.max(h, node.y + nodeHeight(nodePorts(node, def.domain)) + 200);
  }
  return { w, h };
}
