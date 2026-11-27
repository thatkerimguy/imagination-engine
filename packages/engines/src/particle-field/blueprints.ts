// particle-field starter blueprints (pure data).
import type { BlueprintExports, BlueprintFieldSpec, GimmickBlueprint } from '@kn/core/gimmicks';
import { base, text } from '../frame-hud/bp-kit.ts';

const FIELDS: BlueprintFieldSpec[] = [
  {
    key: 'preset',
    label: 'Particles',
    type: 'select',
    options: [
      { value: 'blossoms', label: 'Blossoms' },
      { value: 'embers', label: 'Embers' },
      { value: 'snow', label: 'Snow' },
      { value: 'digital-rain', label: 'Digital rain' },
      { value: 'fireflies', label: 'Fireflies' },
      { value: 'ash', label: 'Ash' },
    ],
  },
  { key: 'density', label: 'Density', type: 'number', min: 4, max: 45, step: 1 },
  { key: 'wind', label: 'Wind', type: 'number', min: -1, max: 1, step: 0.1 },
  { key: 'speed', label: 'Speed', type: 'number', min: 0.2, max: 2, step: 0.1 },
  {
    key: 'colorRole',
    label: 'Colour',
    type: 'select',
    options: [
      { value: 'primary', label: 'Primary' },
      { value: 'secondary', label: 'Secondary' },
      { value: 'warning', label: 'Warning' },
      { value: 'neutral', label: 'Neutral' },
    ],
  },
  text('caption', 'Caption', true),
  { key: 'fullBleed', label: 'Fill the screen behind the text', type: 'boolean', optional: true },
];

const EXPORTS: BlueprintExports = {
  transcript: '[{{preset}} drift] {{caption}}',
  summary: 'Ambient {{preset}}. {{caption}}',
  epubXhtml: '<hr class="kn-particles"/><p style="text-align:center"><em>{{caption}}</em></p>',
  royalRoadHtml: '<hr><p style="text-align:center"><em>{{caption}}</em></p>',
};

export const PARTICLE_FIELD_BLUEPRINTS: GimmickBlueprint[] = [
  {
    ...base,
    id: 'cherry-blossom-drift',
    engine: 'particle-field',
    genre: 'romance',
    subgenre: 'spring',
    mood: ['tender', 'serene'],
    tags: ['blossoms', 'petals', 'spring', 'drift'],
    name: 'Cherry Blossom Drift',
    tagline: 'Soft petals drifting across a quiet band of the page.',
    fields: FIELDS,
    defaultProps: {
      preset: 'blossoms',
      density: 22,
      wind: 0.3,
      speed: 1,
      colorRole: 'secondary',
      caption: 'Petals fell like slow snow.',
      fullBleed: false,
    },
    sampleProps: {
      preset: 'fireflies',
      density: 18,
      wind: 0,
      speed: 0.8,
      colorRole: 'primary',
      caption: 'The meadow lit up, one spark at a time.',
    },
    visual: {
      layout: 'blossoms',
      ornament: 'minimal',
      accentRole: 'secondary',
      borderStyle: 'none',
      motionPreset: 'fade',
    },
    exports: EXPORTS,
  },
  {
    ...base,
    tier: 'pro',
    id: 'ember-storm',
    engine: 'particle-field',
    genre: 'fantasy',
    subgenre: 'dragonfire',
    mood: ['fierce', 'burning'],
    tags: ['embers', 'fire', 'ash', 'storm'],
    name: 'Ember Storm',
    tagline: 'Sparks rising from a burning world.',
    fields: FIELDS,
    defaultProps: {
      preset: 'embers',
      density: 40,
      wind: -0.4,
      speed: 1.3,
      colorRole: 'warning',
      caption: 'The sky rained fire.',
      fullBleed: false,
    },
    sampleProps: {
      preset: 'ash',
      density: 30,
      wind: 0.2,
      speed: 0.9,
      colorRole: 'neutral',
      caption: 'Grey flakes settled on everything.',
    },
    visual: {
      layout: 'embers',
      ornament: 'inherit',
      accentRole: 'warning',
      borderStyle: 'none',
      motionPreset: 'rise',
    },
    exports: EXPORTS,
  },
];
