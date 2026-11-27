// frame-hud starter blueprints.
import type { BlueprintExports, BlueprintFieldSpec, GimmickBlueprint } from '@kn/core/gimmicks';
import { base, opts, sound, text, list } from './bp-kit.ts';

const HUD_FIELDS: BlueprintFieldSpec[] = [
  text('header', 'Header'),
  text('title', 'Title'),
  text('badge', 'Badge', true),
  list('lines', 'Lines', 'Line'),
  text('footer', 'Footer', true),
  {
    key: 'accentRole',
    label: 'Accent',
    type: 'select',
    options: opts('primary', 'secondary', 'warning', 'success', 'neutral'),
    optional: true,
  },
  sound,
];
const hudExports = (lead: string): BlueprintExports => ({
  transcript: `${lead}{{header}}\n{{title}} {{badge}}\n{{#each lines}}> {{.}}\n{{/each}}{{footer}}`,
  summary: '{{header}}: {{title}}',
  epubXhtml:
    '<aside class="kn-hud" role="note"><p><strong>{{header}}</strong></p><h4>{{title}}</h4><ul>{{#each lines}}<li>{{.}}</li>{{/each}}</ul><p><em>{{footer}}</em></p></aside>',
  royalRoadHtml:
    '<blockquote><p><strong>{{header}}</strong> {{badge}}</p><p><b>{{title}}</b></p>{{#each lines}}<p>{{.}}</p>{{/each}}<p><i>{{footer}}</i></p></blockquote>',
});

export const FRAME_HUD_BLUEPRINTS: GimmickBlueprint[] = [
  {
    ...base,
    id: 'system-notification',
    engine: 'frame-hud',
    genre: 'litrpg',
    subgenre: 'system-ui',
    mood: ['tense', 'rewarding'],
    tags: ['hud', 'stats', 'notification'],
    name: 'System Notification',
    tagline: 'A glowing status panel that interrupts the prose.',
    fields: HUD_FIELDS,
    defaultProps: {
      header: '[SYSTEM NOTIFICATION]',
      title: 'Skill acquired: Shadow Step',
      badge: 'NEW',
      lines: ['Agility +2', 'Stealth rank: Novice', 'Cooldown: 40 s'],
      footer: '',
      sound: true,
    },
    sampleProps: {
      header: '[WARNING]',
      title: 'Hostile presence detected',
      badge: 'DANGER',
      lines: ['Distance: 12 m', 'Threat: unknown'],
      footer: 'Proceed with caution.',
      accentRole: 'warning',
    },
    visual: {
      layout: 'system',
      ornament: 'inherit',
      accentRole: 'primary',
      borderStyle: 'glow',
      motionPreset: 'sweep',
    },
    sound: { patch: 'chime', gain: 0.5 },
    haptics: 'tap',
    exports: hudExports('[SYSTEM] '),
  },
  {
    ...base,
    id: 'royal-decree',
    engine: 'frame-hud',
    genre: 'fantasy',
    subgenre: 'court',
    mood: ['solemn', 'regal'],
    tags: ['decree', 'proclamation', 'seal'],
    name: 'Royal Decree',
    tagline: 'A proclamation under seal, set in display serif.',
    fields: HUD_FIELDS,
    defaultProps: {
      header: 'By Order of the Crown',
      title: 'Proclamation of the Third Moon',
      badge: '',
      lines: ['All gates shall close at dusk.', 'No lantern shall burn past the second bell.'],
      footer: 'Sealed this day, Queen Ilvane',
      sound: true,
    },
    sampleProps: {
      header: 'Hear Ye',
      title: 'Edict of Silence',
      badge: '',
      lines: ['The bells shall not ring until the heir is found.'],
      footer: 'Sealed in wax and ash',
    },
    visual: {
      layout: 'decree',
      ornament: 'parchment-filigree',
      surface: 'parchment',
      accentRole: 'secondary',
      borderStyle: 'double',
      motionPreset: 'fade',
    },
    sound: { patch: 'seal-crack', gain: 0.5 },
    haptics: 'heavy',
    exports: hudExports(''),
  },
];
