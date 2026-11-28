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
  transcript: `${lead}{{header}}
{{title}}{{#if badge}} {{badge}}{{/if}}
{{#each lines}}> {{.}}
{{/each}}{{footer}}`,
  summary: '{{header}}: {{title}}',
  epubXhtml:
    '<aside class="kn-hud" role="note"><p><strong>{{header}}</strong></p><h4>{{title}}</h4>{{#if lines}}<ul>{{#each lines}}<li>{{.}}</li>{{/each}}</ul>{{/if}}{{#if footer}}<p><em>{{footer}}</em></p>{{/if}}</aside>',
  royalRoadHtml:
    '<blockquote><p><strong>{{header}}</strong>{{#if badge}} {{badge}}{{/if}}</p><p><strong>{{title}}</strong></p>{{#each lines}}<p>{{.}}</p>{{/each}}{{#if footer}}<p><em>{{footer}}</em></p>{{/if}}</blockquote>',
});

// The classic Royal Road LitRPG "blue box": a cobalt-bordered table built only from tags and
// inline styles the site's editor keeps (no classes, no <style>). Driven 100% by this template.
const RR_TABLE =
  'border-collapse:collapse;width:100%;background:#0c2340;color:#eef6ff;border:2px solid #3b82f6;margin:1em 0;';
const RR_CELL = 'padding:6px 12px;border:1px solid #3b82f6;';
const systemBoxExports = (): BlueprintExports => ({
  ...hudExports('[SYSTEM] '),
  royalRoadHtml:
    `<table style="${RR_TABLE}"><tbody>` +
    `<tr><td style="${RR_CELL}text-align:center;font-weight:700;letter-spacing:0.06em;">{{header}}{{#if badge}} · {{badge}}{{/if}}</td></tr>` +
    `<tr><td style="${RR_CELL}text-align:center;font-weight:700;">{{title}}</td></tr>` +
    `{{#each lines}}<tr><td style="${RR_CELL}">{{.}}</td></tr>{{/each}}` +
    `{{#if footer}}<tr><td style="${RR_CELL}font-style:italic;">{{footer}}</td></tr>{{/if}}` +
    '</tbody></table>',
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
    exports: systemBoxExports(),
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
