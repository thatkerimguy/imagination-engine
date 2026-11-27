// spatial-layout starter blueprints (pure data).
import type { BlueprintExports, BlueprintFieldSpec, GimmickBlueprint } from '@kn/core/gimmicks';
import { base, sound, text } from '../frame-hud/bp-kit.ts';

const FIELDS: BlueprintFieldSpec[] = [
  {
    key: 'layout',
    label: 'Layout',
    type: 'select',
    options: [
      { value: 'dual-pov', label: 'Dual POV' },
      { value: 'staggered-echo', label: 'Staggered echo' },
      { value: 'split-timeline', label: 'Split timeline' },
      { value: 'falling-lines', label: 'Falling lines' },
    ],
  },
  text('leftLabel', 'Left label', true),
  text('rightLabel', 'Right label', true),
  {
    key: 'entries',
    label: 'Lines',
    type: 'records',
    minItems: 1,
    maxItems: 16,
    itemLabel: 'Line',
    columns: [
      {
        key: 'col',
        label: 'Column',
        type: 'select',
        optional: true,
        options: [
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
          { value: 'center', label: 'Center' },
        ],
      },
      { key: 'text', label: 'Text', type: 'text' },
      { key: 'indent', label: 'Indent', type: 'number', optional: true },
    ],
  },
  sound,
];

const EXPORTS: BlueprintExports = {
  transcript: '{{leftLabel}} / {{rightLabel}}\n{{#each entries}}{{text}}\n{{/each}}',
  summary: '{{leftLabel}} and {{rightLabel}}: {{#each entries}}{{text}} {{/each}}',
  epubXhtml:
    '<section class="kn-spatial"><h4>{{leftLabel}} / {{rightLabel}}</h4>{{#each entries}}<p>{{text}}</p>{{/each}}</section>',
  royalRoadHtml:
    '<div style="border-left:2px solid #888;padding-left:10px"><p><strong>{{leftLabel}} / {{rightLabel}}</strong></p>{{#each entries}}<p>{{text}}</p>{{/each}}</div>',
};

export const SPATIAL_LAYOUT_BLUEPRINTS: GimmickBlueprint[] = [
  {
    ...base,
    tier: 'pro',
    id: 'dual-pov-split',
    engine: 'spatial-layout',
    genre: 'thriller',
    subgenre: 'dual-pov',
    mood: ['tense', 'parallel'],
    tags: ['pov', 'columns', 'split', 'chase'],
    name: 'Dual POV Split',
    tagline: 'Hunter and hunted, side by side on one screen.',
    fields: FIELDS,
    defaultProps: {
      layout: 'dual-pov',
      leftLabel: 'Detective',
      rightLabel: 'Runner',
      entries: [
        { col: 'left', text: 'The alley is empty. Too empty.' },
        { col: 'right', text: 'Keep moving. Do not look back.' },
        { col: 'left', text: 'A coat on the fence, still swinging.' },
        { col: 'right', text: 'Her lungs burned. The gate was close.' },
      ],
      sound: false,
    },
    sampleProps: {
      layout: 'split-timeline',
      leftLabel: '1999',
      rightLabel: 'Today',
      entries: [
        { col: 'left', text: 'The house was bright and loud.' },
        { col: 'right', text: 'The house is a shell of damp walls.' },
        { col: 'center', text: 'Somewhere between, a door closed.' },
      ],
    },
    visual: {
      layout: 'dual-pov',
      ornament: 'inherit',
      accentRole: 'primary',
      borderStyle: 'hairline',
      motionPreset: 'rise',
    },
    exports: EXPORTS,
  },
  {
    ...base,
    id: 'falling-lines-poem',
    engine: 'spatial-layout',
    genre: 'horror',
    subgenre: 'poem',
    mood: ['dread', 'sinking'],
    tags: ['poem', 'falling', 'verse', 'stair'],
    name: 'Falling Lines Poem',
    tagline: 'Verse that steps downward like a descent into the dark.',
    fields: FIELDS,
    defaultProps: {
      layout: 'falling-lines',
      entries: [
        { text: 'The stairs go down' },
        { text: 'and down' },
        { text: 'and down,' },
        { text: 'and the lamp does not follow.' },
      ],
      sound: false,
    },
    sampleProps: {
      layout: 'staggered-echo',
      entries: [{ text: 'Hello?' }, { text: 'hello?' }, { text: 'hello…', indent: 6 }],
    },
    visual: {
      layout: 'falling-lines',
      ornament: 'minimal',
      accentRole: 'warning',
      borderStyle: 'none',
      motionPreset: 'fade',
    },
    exports: EXPORTS,
  },
];
