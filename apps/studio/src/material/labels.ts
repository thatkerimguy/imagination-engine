import type { MaterialProblem } from '@ie/material';
import type { MaterialDef, MaterialNodeType } from '@ie/story';
import type { Translator } from '@ie/i18n';
import type { MessageKey } from '../messages.ts';

export const nodeName = (type: MaterialNodeType): MessageKey => `matNode.${type}`;
export const portName = (port: string): MessageKey => `matPort.${port}` as MessageKey;

/** A compiler problem in the Studio's language, naming the node it is about. */
export function problemText(
  t: Translator<MessageKey>,
  problem: MaterialProblem,
  material: MaterialDef,
): string {
  const node = material.nodes.find((n) => n.id === problem.node);
  return t(`matProblem.${problem.code}`, {
    domain: t(material.domain === 'post' ? 'mat.domain.post' : 'mat.domain.text'),
    node: node ? t(nodeName(node.type)) : '',
  });
}

/** A short reading of a value for a node card: "0.5", "0.2, 0.8". */
export function shortValue(value: number | readonly number[]): string {
  const parts = typeof value === 'number' ? [value] : [...value];
  return parts.map((n) => String(Math.round(n * 100) / 100)).join(', ');
}
