import { defineModuleSchema } from '@kn/core';

export type AmbientPreset = 'rain' | 'barroom' | 'neon-hum' | 'custom';

export interface AmbientBedProps {
  action: 'play' | 'stop';
  preset: AmbientPreset;
  /** Novel-relative audio file, used when `preset` is `custom`. */
  asset: string;
  volume: number;
  fadeSeconds: number;
}

export const schema = defineModuleSchema<AmbientBedProps>({
  meta: {
    id: 'core-ambient-bed',
    version: 1,
    name: 'Ambient Bed',
    genre: 'core',
    icon: '🌧️',
    layer: 'audio-haptic',
    description: 'Crossfades a looping background ambience under the prose.',
  },
  fields: [
    {
      key: 'action',
      label: 'Action',
      type: 'select',
      options: [
        { value: 'play', label: 'Play / crossfade' },
        { value: 'stop', label: 'Fade out' },
      ],
    },
    {
      key: 'preset',
      label: 'Ambience',
      type: 'select',
      options: [
        { value: 'rain', label: 'Rain' },
        { value: 'barroom', label: 'Barroom hum' },
        { value: 'neon-hum', label: 'Neon hum' },
        { value: 'custom', label: 'My audio file' },
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
    { key: 'volume', label: 'Volume', type: 'number', min: 0, max: 1, step: 0.05 },
    {
      key: 'fadeSeconds',
      label: 'Fade',
      type: 'number',
      min: 0,
      max: 12,
      step: 0.5,
      unit: 's',
      help: 'How long the crossfade (or fade-out) takes.',
    },
  ],
  defaults: { action: 'play', preset: 'rain', asset: '', volume: 0.5, fadeSeconds: 3 },
  refine: (p) =>
    p.action === 'play' && p.preset === 'custom' && p.asset.trim() === ''
      ? ['asset: pick an audio file for a custom ambience']
      : [],
});

export const meta = schema.meta;
