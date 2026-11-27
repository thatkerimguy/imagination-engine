// audio-stinger starter blueprints (pure data). The foley is synthesised live; nothing to download.
import type { BlueprintExports, BlueprintFieldSpec, GimmickBlueprint } from '@kn/core/gimmicks';
import { base, text } from '../frame-hud/bp-kit.ts';

const FIELDS: BlueprintFieldSpec[] = [
  {
    key: 'foley',
    label: 'Sound',
    type: 'select',
    options: [
      { value: 'unsheathe', label: 'Blade unsheathed' },
      { value: 'thunder', label: 'Thunder' },
      { value: 'level-chord', label: 'Level-up chord' },
      { value: 'revolver-click', label: 'Revolver click' },
      { value: 'typewriter-bell', label: 'Typewriter bell' },
      { value: 'heartbeat', label: 'Heartbeat' },
      { value: 'radio-static', label: 'Radio static' },
    ],
  },
  text('label', 'Caption'),
  { key: 'gain', label: 'Loudness', type: 'number', min: 0, max: 1, step: 0.05 },
  {
    key: 'pitchShift',
    label: 'Pitch',
    type: 'number',
    min: -12,
    max: 12,
    step: 1,
    unit: 'st',
    optional: true,
  },
];

const EXPORTS: BlueprintExports = {
  transcript: '[Sound: {{label}}]',
  summary: 'Sound cue: {{label}}',
  epubXhtml: '<p class="kn-sound"><em>[Sound: {{label}}]</em></p>',
  royalRoadHtml: '<p><em>[Sound: {{label}}]</em></p>',
};

export const AUDIO_STINGER_BLUEPRINTS: GimmickBlueprint[] = [
  {
    ...base,
    id: 'blade-unsheathe',
    engine: 'audio-stinger',
    genre: 'fantasy',
    subgenre: 'swordplay',
    mood: ['tense', 'sharp'],
    tags: ['sword', 'blade', 'steel', 'foley'],
    name: 'Blade Unsheathed',
    tagline: 'A bright rasp of steel leaving its scabbard.',
    fields: FIELDS,
    defaultProps: {
      foley: 'unsheathe',
      label: 'Steel slid from its scabbard',
      gain: 0.6,
      pitchShift: 0,
    },
    sampleProps: { foley: 'thunder', label: 'Thunder rolled over the keep', gain: 0.7 },
    visual: {
      layout: 'unsheathe',
      ornament: 'minimal',
      accentRole: 'secondary',
      borderStyle: 'none',
      motionPreset: 'sweep',
    },
    haptics: 'tap',
    exports: EXPORTS,
  },
  {
    ...base,
    id: 'level-up-chord',
    engine: 'audio-stinger',
    genre: 'litrpg',
    subgenre: 'progression',
    mood: ['rewarding', 'bright'],
    tags: ['level-up', 'chord', 'reward', 'chime'],
    name: 'Level-Up Chord',
    tagline: 'A short bell-like major chord for a hard-earned level.',
    fields: FIELDS,
    defaultProps: { foley: 'level-chord', label: 'Level up!', gain: 0.55, pitchShift: 0 },
    sampleProps: {
      foley: 'typewriter-bell',
      label: 'Ding. Quest complete.',
      gain: 0.5,
      pitchShift: 2,
    },
    visual: {
      layout: 'level-chord',
      ornament: 'inherit',
      accentRole: 'success',
      borderStyle: 'none',
      motionPreset: 'pulse',
    },
    haptics: 'double',
    exports: EXPORTS,
  },
];
