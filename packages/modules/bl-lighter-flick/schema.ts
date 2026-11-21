import { defineModuleSchema } from '@kn/core';

export interface LighterProps {
  action: 'ignite' | 'extinguish';
  corner: 'bottom-left' | 'bottom-right';
  trigger: 'auto' | 'tap';
  /** Strength of the amber margin glow. */
  warmth: number;
  /** 0 keeps the flame lit until the chapter ends or an extinguish block fires. */
  autoExtinguishMs: number;
  sfx: boolean;
}

const ON_IGNITE = { field: 'action', equals: 'ignite' } as const;

export const schema = defineModuleSchema<LighterProps>({
  meta: {
    id: 'bl-lighter-flick',
    version: 1,
    name: 'Lighter Flick',
    genre: 'black-lagoon',
    icon: '🔥',
    layer: 'overlay-vfx',
    description:
      'A brass Zippo sparks in the corner and its tilt-reactive flame warms the dark margin until the lid snaps shut.',
  },
  fields: [
    {
      key: 'action',
      label: 'Action',
      type: 'select',
      options: [
        { value: 'ignite', label: 'Ignite the lighter' },
        { value: 'extinguish', label: 'Snap the lid shut' },
      ],
    },
    {
      key: 'corner',
      label: 'Corner',
      type: 'select',
      options: [
        { value: 'bottom-left', label: 'Bottom left' },
        { value: 'bottom-right', label: 'Bottom right' },
      ],
      showWhen: ON_IGNITE,
    },
    {
      key: 'trigger',
      label: 'Flick',
      type: 'select',
      options: [
        { value: 'auto', label: 'Automatically' },
        { value: 'tap', label: 'Reader taps to flick' },
      ],
      showWhen: ON_IGNITE,
    },
    {
      key: 'warmth',
      label: 'Glow warmth',
      type: 'number',
      min: 0.2,
      max: 1,
      step: 0.05,
      showWhen: ON_IGNITE,
    },
    {
      key: 'autoExtinguishMs',
      label: 'Burns for',
      type: 'number',
      min: 0,
      max: 30000,
      step: 500,
      unit: 'ms',
      help: '0 keeps it lit until an extinguish block or the end of the chapter.',
      showWhen: ON_IGNITE,
    },
    { key: 'sfx', label: 'Sound', type: 'toggle' },
  ],
  defaults: {
    action: 'ignite',
    corner: 'bottom-right',
    trigger: 'auto',
    warmth: 0.75,
    autoExtinguishMs: 0,
    sfx: true,
  },
});

export const meta = schema.meta;
