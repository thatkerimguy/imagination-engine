import { defineModuleSchema } from '@kn/core';

export type DiceMaterial = 'ivory' | 'casino-red' | 'brass' | 'obsidian';

export interface DiceProps {
  count: number;
  material: DiceMaterial;
  outcomeMode: 'scripted' | 'random';
  /** One face value per die, used when `outcomeMode` is `scripted`. */
  scriptedNumbers: number[];
  trigger: 'auto' | 'tap-or-shake';
  throwFrom: 'left' | 'right' | 'bottom';
  /** How long the settled dice stay readable before lifting away. */
  holdSeconds: number;
  sound: boolean;
}

export const schema = defineModuleSchema<DiceProps>({
  meta: {
    id: 'bl-dice-3d',
    version: 1,
    name: '3D Dice Throw',
    genre: 'black-lagoon',
    icon: '🎲',
    layer: 'overlay-vfx',
    description:
      'Real-physics d6 dice tumble across the open screen and land on your scripted numbers.',
  },
  fields: [
    { key: 'count', label: 'Dice', type: 'number', min: 1, max: 3, step: 1 },
    {
      key: 'material',
      label: 'Material',
      type: 'select',
      options: [
        { value: 'ivory', label: 'Ivory' },
        { value: 'casino-red', label: 'Casino Red' },
        { value: 'brass', label: 'Brushed Brass' },
        { value: 'obsidian', label: 'Obsidian' },
      ],
    },
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
      label: 'Faces that land up',
      type: 'number-list',
      min: 1,
      max: 6,
      step: 1,
      minItems: 1,
      maxItems: 3,
      help: 'One number per die.',
      showWhen: { field: 'outcomeMode', equals: 'scripted' },
    },
    {
      key: 'trigger',
      label: 'Throw',
      type: 'select',
      options: [
        { value: 'auto', label: 'Automatically' },
        { value: 'tap-or-shake', label: 'Reader taps or shakes' },
      ],
    },
    {
      key: 'throwFrom',
      label: 'Thrown from',
      type: 'select',
      options: [
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
        { value: 'bottom', label: 'Bottom' },
      ],
    },
    {
      key: 'holdSeconds',
      label: 'Hold result',
      type: 'number',
      min: 0.5,
      max: 8,
      step: 0.5,
      unit: 's',
    },
    { key: 'sound', label: 'Clatter sound', type: 'toggle' },
  ],
  defaults: {
    count: 2,
    material: 'ivory',
    outcomeMode: 'scripted',
    scriptedNumbers: [1, 1],
    trigger: 'auto',
    throwFrom: 'left',
    holdSeconds: 1.5,
    sound: true,
  },
  refine: (p) =>
    p.outcomeMode === 'scripted' && p.scriptedNumbers.length !== p.count
      ? [`scriptedNumbers: give exactly ${p.count} number${p.count === 1 ? '' : 's'}, one per die`]
      : [],
});

export const meta = schema.meta;
