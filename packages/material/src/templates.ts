import type { Label, MaterialDef, MaterialDomain, MaterialNode } from '@ie/story';

/**
 * Starter graphs, so a new material shows something at once (as new blocks do). Ids come from the
 * caller (`createId` in the Studio) so this package stays free of @ie/core.
 */
export function materialTemplate(
  domain: MaterialDomain,
  name: Label,
  makeId: (prefix: string) => string,
): MaterialDef {
  return domain === 'text' ? waveText(name, makeId) : beatGlow(name, makeId);
}

/** Positions above are written on a compact grid; the Studio's cards need 1.4× the height. */
function spaced(nodes: readonly MaterialNode[]): MaterialNode[] {
  return nodes.map((n) => ({ ...n, y: Math.round(n.y * 1.4) }));
}

/** Glyphs ride a wave and shift hue along the word; `height` and `colour` are parameters. */
function waveText(name: Label, makeId: (prefix: string) => string): MaterialDef {
  const id = () => makeId('mn');
  const height = makeId('mp');
  const tint = makeId('mp');
  const n = {
    index: id(),
    spread: id(),
    time: id(),
    speed: id(),
    phase: id(),
    sin: id(),
    heightParam: id(),
    lift: id(),
    combine: id(),
    hueStep: id(),
    hue: id(),
    hsv: id(),
    ink: id(),
    tintParam: id(),
    mix: id(),
    shape: id(),
    out: id(),
  };
  const nodes: MaterialNode[] = [
    { id: n.index, type: 'glyphIndex', x: 40, y: 40 },
    { id: n.spread, type: 'multiply', x: 240, y: 40, inputs: { a: { node: n.index } }, values: { b: 0.6 } },
    { id: n.time, type: 'time', x: 40, y: 160 },
    { id: n.speed, type: 'multiply', x: 240, y: 160, inputs: { a: { node: n.time } }, values: { b: 4 } },
    {
      id: n.phase,
      type: 'add',
      x: 440,
      y: 100,
      inputs: { a: { node: n.spread }, b: { node: n.speed } },
    },
    { id: n.sin, type: 'sin', x: 640, y: 100, inputs: { x: { node: n.phase } } },
    { id: n.heightParam, type: 'param', x: 640, y: 220, param: height },
    {
      id: n.lift,
      type: 'multiply',
      x: 840,
      y: 140,
      inputs: { a: { node: n.sin }, b: { node: n.heightParam } },
    },
    { id: n.combine, type: 'combine', x: 1040, y: 140, inputs: { y: { node: n.lift } } },
    { id: n.hueStep, type: 'multiply', x: 240, y: 300, inputs: { a: { node: n.index } }, values: { b: 0.08 } },
    { id: n.hue, type: 'fract', x: 440, y: 300, inputs: { x: { node: n.hueStep } } },
    { id: n.hsv, type: 'hsv', x: 640, y: 340, inputs: { hue: { node: n.hue } }, values: { saturation: 0.6 } },
    { id: n.ink, type: 'ink', x: 640, y: 480 },
    { id: n.tintParam, type: 'param', x: 640, y: 580, param: tint },
    {
      id: n.mix,
      type: 'mix',
      x: 840,
      y: 420,
      inputs: { a: { node: n.ink }, b: { node: n.hsv }, t: { node: n.tintParam } },
    },
    { id: n.shape, type: 'shape', x: 840, y: 580 },
    {
      id: n.out,
      type: 'output',
      x: 1240,
      y: 320,
      inputs: {
        color: { node: n.mix },
        alpha: { node: n.shape },
        offset: { node: n.combine, port: 'xy' },
      },
    },
  ];
  return {
    id: makeId('mt'),
    name,
    domain: 'text',
    nodes: spaced(nodes),
    params: [
      { id: height, name: { en: 'Height', tr: 'Yükseklik' }, default: 6, min: 0, max: 40 },
      { id: tint, name: { en: 'Colour', tr: 'Renk' }, default: 0.5, min: 0, max: 1 },
    ],
  };
}

/** A soft glow at the screen's edges that swells on each beat; `strength` is a parameter. */
function beatGlow(name: Label, makeId: (prefix: string) => string): MaterialDef {
  const id = () => makeId('mn');
  const strength = makeId('mp');
  const n = {
    uv: id(),
    centre: id(),
    dist: id(),
    edge: id(),
    pulse: id(),
    strengthParam: id(),
    amount: id(),
    alpha: id(),
    color: id(),
    out: id(),
  };
  const nodes: MaterialNode[] = [
    { id: n.uv, type: 'uv', x: 40, y: 40 },
    { id: n.centre, type: 'vector', x: 40, y: 160, values: { value: [0.5, 0.5] } },
    {
      id: n.dist,
      type: 'distance',
      x: 240,
      y: 100,
      inputs: { a: { node: n.uv }, b: { node: n.centre } },
    },
    {
      id: n.edge,
      type: 'smoothstep',
      x: 440,
      y: 100,
      inputs: { x: { node: n.dist } },
      values: { from: 0.3, to: 0.8 },
    },
    { id: n.pulse, type: 'pulse', x: 240, y: 260 },
    { id: n.strengthParam, type: 'param', x: 240, y: 360, param: strength },
    {
      id: n.amount,
      type: 'mix',
      x: 440,
      y: 300,
      inputs: { b: { node: n.pulse }, t: { node: n.strengthParam } },
      values: { a: 0.25 },
    },
    {
      id: n.alpha,
      type: 'multiply',
      x: 640,
      y: 180,
      inputs: { a: { node: n.edge }, b: { node: n.amount } },
    },
    { id: n.color, type: 'color', x: 640, y: 340, values: { value: [0.95, 0.55, 0.3] } },
    {
      id: n.out,
      type: 'output',
      x: 840,
      y: 240,
      inputs: { color: { node: n.color }, alpha: { node: n.alpha } },
    },
  ];
  return {
    id: makeId('mt'),
    name,
    domain: 'post',
    nodes: spaced(nodes),
    params: [
      { id: strength, name: { en: 'Strength', tr: 'Güç' }, default: 0.6, min: 0, max: 1 },
    ],
  };
}
