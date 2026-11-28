// Synthetic schemas for form-state tests (stand-ins for the retired v1 modules).
import { defineModuleSchema, type ModuleSchemaDefinition } from '@kn/core';

type S = ModuleSchemaDefinition<Record<string, unknown>>;

const meta = (id: string) => ({
  id,
  version: 1,
  name: id,
  genre: 'core' as const,
  icon: 'x',
  layer: 'inline' as const,
  description: 'Test fixture.',
});

interface DiceLike {
  count: number;
  outcomeMode: 'scripted' | 'random';
  scriptedNumbers: number[];
}

export const diceS = defineModuleSchema<DiceLike>({
  meta: meta('fx-dice'),
  fields: [
    { key: 'count', label: 'Dice', type: 'number', min: 1, max: 3, step: 1 },
    {
      key: 'outcomeMode',
      label: 'Outcome',
      type: 'select',
      options: [
        { value: 'scripted', label: 'Scripted' },
        { value: 'random', label: 'True random' },
      ],
    },
    {
      key: 'scriptedNumbers',
      label: 'Faces',
      type: 'number-list',
      min: 1,
      max: 6,
      step: 1,
      minItems: 1,
      maxItems: 3,
      showWhen: { field: 'outcomeMode', equals: 'scripted' },
    },
  ],
  defaults: { count: 2, outcomeMode: 'scripted', scriptedNumbers: [1, 1] },
  refine: (p) =>
    p.outcomeMode === 'scripted' && p.scriptedNumbers.length !== p.count
      ? [`scriptedNumbers: give exactly ${p.count} number${p.count === 1 ? '' : 's'}, one per die`]
      : [],
}) as unknown as S;

interface AmbientLike {
  action: 'play' | 'stop';
  preset: 'rain' | 'custom';
  asset: string;
}

export const ambientS = defineModuleSchema<AmbientLike>({
  meta: meta('fx-ambient'),
  fields: [
    {
      key: 'action',
      label: 'Action',
      type: 'select',
      options: [
        { value: 'play', label: 'Play' },
        { value: 'stop', label: 'Stop' },
      ],
    },
    {
      key: 'preset',
      label: 'Ambience',
      type: 'select',
      options: [
        { value: 'rain', label: 'Rain' },
        { value: 'custom', label: 'Custom' },
      ],
      showWhen: { field: 'action', equals: 'play' },
    },
    {
      key: 'asset',
      label: 'Audio file',
      type: 'asset',
      assetKind: 'audio',
      showWhen: { field: 'preset', equals: 'custom' },
    },
  ],
  defaults: { action: 'play', preset: 'rain', asset: '' },
}) as unknown as S;

export const chatS = defineModuleSchema<{ messages: string[] }>({
  meta: meta('fx-chat'),
  fields: [{ key: 'messages', label: 'Messages', type: 'string-list', minItems: 1, maxItems: 8 }],
  defaults: { messages: ['Link established.'] },
  refine: (p) => (p.messages.some((m) => m.trim() === '') ? ['messages: remove empty lines'] : []),
}) as unknown as S;
