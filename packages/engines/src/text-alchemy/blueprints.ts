// text-alchemy starter blueprints.
import type { BlueprintExports, BlueprintFieldSpec, GimmickBlueprint } from '@kn/core/gimmicks';
import { base, opts, multi, text } from '../frame-hud/bp-kit.ts';

const ALCHEMY_FIELDS: BlueprintFieldSpec[] = [
  {
    key: 'mode',
    label: 'Effect',
    type: 'select',
    options: opts('gaslight', 'whisper', 'redact', 'cipher'),
  },
  multi('initialText', 'What the reader sees first'),
  multi('alteredText', 'What it becomes'),
  text('hint', 'Hint', true),
];
const alchemyExports: BlueprintExports = {
  transcript: '{{initialText}}\n(becomes) {{alteredText}}',
  summary: 'Text that changes: {{initialText}}',
  epubXhtml: '<div class="kn-alchemy"><p>{{initialText}}</p><p><em>{{alteredText}}</em></p></div>',
  royalRoadHtml: '<p>{{initialText}}</p><p><i>{{alteredText}}</i></p>',
};

export const TEXT_ALCHEMY_BLUEPRINTS: GimmickBlueprint[] = [
  {
    ...base,
    id: 'gaslight-rewrite',
    engine: 'text-alchemy',
    genre: 'psych-thriller',
    subgenre: 'unreliable-narrator',
    mood: ['uneasy', 'paranoid'],
    tags: ['gaslight', 'rewrite', 'whisper'],
    name: 'Gaslight Rewrite',
    tagline: 'A sentence that is not quite what you read before.',
    fields: ALCHEMY_FIELDS,
    defaultProps: {
      mode: 'gaslight',
      initialText: 'The door was locked when I left. I am certain of it.',
      alteredText: 'The door was open when I left. You told me so yourself.',
      hint: '',
    },
    sampleProps: {
      mode: 'whisper',
      initialText: 'Everything is fine.',
      alteredText: 'Nothing here is yours.',
      hint: 'Hold to listen',
    },
    visual: {
      layout: 'gaslight',
      ornament: 'inherit',
      accentRole: 'secondary',
      borderStyle: 'hairline',
      motionPreset: 'fade',
    },
    exports: alchemyExports,
  },
  {
    ...base,
    id: 'redacted-file',
    engine: 'text-alchemy',
    genre: 'thriller',
    subgenre: 'conspiracy',
    mood: ['secretive', 'tense'],
    tags: ['redact', 'classified', 'dossier'],
    name: 'Redacted File',
    tagline: 'Black bars the reader can peel away.',
    fields: ALCHEMY_FIELDS,
    defaultProps: {
      mode: 'redact',
      initialText:
        'Subject [[Dr. Maren Voss]] was last seen at [[Pier 9]] carrying the [[blue ledger]].',
      alteredText: 'Declassified in part.',
      hint: 'Tap a bar to read it.',
    },
    sampleProps: {
      mode: 'redact',
      initialText: 'The informant, [[Detective Halloran]], never reached the safehouse.',
      alteredText: 'Declassified in part.',
      hint: '',
    },
    visual: {
      layout: 'redact',
      ornament: 'dossier-stamp',
      surface: 'paper-grain',
      accentRole: 'warning',
      borderStyle: 'hairline',
      motionPreset: 'fade',
    },
    exports: alchemyExports,
  },
];
