// screen-fx starter blueprints (pure data).
import type { BlueprintExports, BlueprintFieldSpec, GimmickBlueprint } from '@kn/core/gimmicks';
import { base, sound, text } from '../frame-hud/bp-kit.ts';

const FIELDS: BlueprintFieldSpec[] = [
  {
    key: 'effect',
    label: 'Effect',
    type: 'select',
    options: [
      { value: 'frost-creep', label: 'Frost creep' },
      { value: 'blood-pulse', label: 'Blood pulse' },
      { value: 'crt-scanlines', label: 'CRT scanlines' },
      { value: 'spotlight', label: 'Spotlight' },
      { value: 'sepia-flash', label: 'Sepia fade' },
      { value: 'rain-streaks', label: 'Rain streaks' },
    ],
  },
  { key: 'intensity', label: 'Intensity', type: 'number', min: 0.1, max: 0.85, step: 0.05 },
  {
    key: 'durationMs',
    label: 'Duration',
    type: 'number',
    min: 1500,
    max: 9000,
    step: 100,
    unit: 'ms',
  },
  text('caption', 'Caption', true),
  sound,
];

const EXPORTS: BlueprintExports = {
  transcript: '[Visual effect: {{effect}}] {{caption}}',
  summary: 'Screen effect: {{effect}}. {{caption}}',
  epubXhtml:
    '<aside class="kn-fx" role="note"><p><em>Visual effect: {{effect}}</em></p><p>{{caption}}</p></aside>',
  royalRoadHtml: '<p><em>[Visual effect: {{effect}}]</em></p><p>{{caption}}</p>',
};

export const SCREEN_FX_BLUEPRINTS: GimmickBlueprint[] = [
  {
    ...base,
    id: 'frost-creep-chill',
    engine: 'screen-fx',
    genre: 'horror',
    subgenre: 'cold-dread',
    mood: ['cold', 'creeping'],
    tags: ['frost', 'ice', 'vignette', 'chill'],
    name: 'Frost Creep',
    tagline: 'Pale frost slowly crawls in from the screen edges.',
    fields: FIELDS,
    defaultProps: {
      effect: 'frost-creep',
      intensity: 0.5,
      durationMs: 4500,
      caption: 'The window fogs from the inside.',
      sound: false,
    },
    sampleProps: {
      effect: 'spotlight',
      intensity: 0.6,
      durationMs: 3500,
      caption: 'One light left.',
    },
    visual: {
      layout: 'frost-creep',
      ornament: 'minimal',
      accentRole: 'secondary',
      borderStyle: 'hairline',
      motionPreset: 'fade',
    },
    exports: EXPORTS,
  },
  {
    ...base,
    tier: 'pro',
    id: 'crt-scanline-glitch',
    engine: 'screen-fx',
    genre: 'cyberpunk',
    subgenre: 'retro-terminal',
    mood: ['glitchy', 'cold'],
    tags: ['crt', 'scanlines', 'terminal', 'retro'],
    name: 'CRT Scanlines',
    tagline: 'A slow-drifting scanline wash, like an old monitor.',
    fields: FIELDS,
    defaultProps: {
      effect: 'crt-scanlines',
      intensity: 0.45,
      durationMs: 5000,
      caption: 'Signal degraded.',
      sound: false,
    },
    sampleProps: {
      effect: 'rain-streaks',
      intensity: 0.35,
      durationMs: 4000,
      caption: 'Neon rain.',
    },
    visual: {
      layout: 'crt-scanlines',
      ornament: 'inherit',
      accentRole: 'primary',
      borderStyle: 'glow',
      motionPreset: 'sweep',
    },
    exports: EXPORTS,
  },
];
