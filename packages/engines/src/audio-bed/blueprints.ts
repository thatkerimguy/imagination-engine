// audio-bed starter blueprints (pure data). Audio is generated live; nothing to download.
import type { BlueprintExports, BlueprintFieldSpec, GimmickBlueprint } from '@kn/core/gimmicks';
import { base, text } from '../frame-hud/bp-kit.ts';

const FIELDS: BlueprintFieldSpec[] = [
  {
    key: 'scene',
    label: 'Ambience',
    type: 'select',
    options: [
      { value: 'rain-tin', label: 'Rain on tin' },
      { value: 'barroom-hum', label: 'Barroom hum' },
      { value: 'starship-bridge', label: 'Starship bridge' },
      { value: 'ocean-surf', label: 'Ocean surf' },
      { value: 'forest-wind', label: 'Forest wind' },
      { value: 'vinyl-crackle', label: 'Vinyl crackle' },
    ],
  },
  text('label', 'Label'),
  { key: 'volume', label: 'Volume', type: 'number', min: 0, max: 1, step: 0.05 },
  {
    key: 'fadeMs',
    label: 'Crossfade',
    type: 'number',
    min: 500,
    max: 12000,
    step: 250,
    unit: 'ms',
  },
  {
    key: 'stop',
    label: 'Fade out the current ambience instead',
    type: 'boolean',
    optional: true,
  },
];

const EXPORTS: BlueprintExports = {
  transcript: '[Ambient sound: {{label}}]',
  summary: 'Ambient sound: {{label}}',
  epubXhtml: '<p class="kn-ambient"><em>[Ambient sound: {{label}}]</em></p>',
  royalRoadHtml: '<p><em>[Ambient sound: {{label}}]</em></p>',
};

export const AUDIO_BED_BLUEPRINTS: GimmickBlueprint[] = [
  {
    ...base,
    id: 'rain-on-tin',
    engine: 'audio-bed',
    genre: 'noir',
    subgenre: 'rainy-night',
    mood: ['moody', 'lonely'],
    tags: ['rain', 'tin', 'ambience', 'night'],
    name: 'Rain on Tin',
    tagline: 'A steady rain drumming on a tin roof, generated live.',
    fields: FIELDS,
    defaultProps: { scene: 'rain-tin', label: 'Rain', volume: 0.55, fadeMs: 4000, stop: false },
    sampleProps: { scene: 'ocean-surf', label: 'Distant surf', volume: 0.45, fadeMs: 3000 },
    visual: {
      layout: 'rain-tin',
      ornament: 'minimal',
      accentRole: 'secondary',
      borderStyle: 'hairline',
      motionPreset: 'fade',
    },
    exports: EXPORTS,
  },
  {
    ...base,
    id: 'barroom-hum',
    engine: 'audio-bed',
    genre: 'thriller',
    subgenre: 'late-bar',
    mood: ['smoky', 'uneasy'],
    tags: ['bar', 'crowd', 'murmur', 'ambience'],
    name: 'Barroom Hum',
    tagline: 'Low crowd murmur and a warm electric hum.',
    fields: FIELDS,
    defaultProps: {
      scene: 'barroom-hum',
      label: 'Barroom',
      volume: 0.5,
      fadeMs: 3500,
      stop: false,
    },
    sampleProps: { scene: 'vinyl-crackle', label: 'Old record', volume: 0.4, fadeMs: 2500 },
    visual: {
      layout: 'barroom-hum',
      ornament: 'minimal',
      accentRole: 'warning',
      borderStyle: 'hairline',
      motionPreset: 'fade',
    },
    exports: EXPORTS,
  },
];
