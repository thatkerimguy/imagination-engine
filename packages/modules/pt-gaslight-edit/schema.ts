import { defineModuleSchema } from '@kn/core';

export type GaslightTone = 'seamless' | 'ink-bruise';

export interface GaslightProps {
  /** The innocent passage the reader sees first. */
  initialText: string;
  /** What it silently becomes after the reader scrolls past and comes back. */
  mutatedText: string;
  /** How far (px) the passage must sit above the top of the screen before it arms. */
  triggerDistancePx: number;
  tone: GaslightTone;
  /** true: stays mutated. false: swaps back and forth on every pass-then-return. */
  once: boolean;
}

export const schema = defineModuleSchema<GaslightProps>({
  meta: {
    id: 'pt-gaslight-edit',
    version: 1,
    name: 'Gaslight Edit',
    genre: 'psych-thriller',
    icon: '🕯️',
    layer: 'inline',
    description: 'A passage that quietly rewrites itself once the reader has scrolled past it.',
  },
  fields: [
    {
      key: 'initialText',
      label: 'Innocent passage',
      type: 'multiline',
      maxLength: 600,
      help: 'Shown first, styled exactly like the surrounding prose.',
    },
    {
      key: 'mutatedText',
      label: 'Mutated passage',
      type: 'multiline',
      maxLength: 600,
      help: 'What the reader finds when they scroll back up.',
    },
    {
      key: 'triggerDistancePx',
      label: 'Scroll-past distance',
      type: 'number',
      min: 80,
      max: 900,
      step: 10,
      unit: 'px',
      help: 'How far above the screen the passage must go before it can change.',
    },
    {
      key: 'tone',
      label: 'Tone',
      type: 'select',
      options: [
        { value: 'seamless', label: 'Seamless (identical to prose)' },
        { value: 'ink-bruise', label: 'Ink bruise (faint tint once mutated)' },
      ],
    },
    {
      key: 'once',
      label: 'Mutate once',
      type: 'toggle',
      help: 'Off: it flips back and forth every time the reader passes and returns.',
    },
  ],
  defaults: {
    initialText: 'The hallway light was still on when I locked the door.',
    mutatedText: 'The hallway light was already off when I unlocked the door.',
    triggerDistancePx: 220,
    tone: 'seamless',
    once: true,
  },
  refine: (p) => {
    const errors: string[] = [];
    if (p.initialText.trim() === '') errors.push('initialText: write the innocent passage');
    if (p.mutatedText.trim() === '') errors.push('mutatedText: write the mutated passage');
    if (errors.length === 0 && p.initialText.trim() === p.mutatedText.trim()) {
      errors.push('mutatedText: must differ from the innocent passage');
    }
    return errors;
  },
});

export const meta = schema.meta;
