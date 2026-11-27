// margin-note starter blueprints (pure data).
import type { BlueprintExports, BlueprintFieldSpec, GimmickBlueprint } from '@kn/core/gimmicks';
import { base, sound } from '../frame-hud/bp-kit.ts';

const STYLE_OPTIONS = [
  { value: 'footnote', label: 'Footnote' },
  { value: 'lore-card', label: 'Lore card' },
  { value: 'scratch-out', label: 'Scratch-out' },
  { value: 'pov-whisper', label: 'POV whisper' },
];

const FIELDS: BlueprintFieldSpec[] = [
  {
    key: 'anchorText',
    label: 'Anchor words',
    type: 'text',
    maxLength: 60,
    help: 'The underlined words in the prose.',
  },
  { key: 'noteTitle', label: 'Note title', type: 'text', maxLength: 60 },
  { key: 'noteBody', label: 'Note text', type: 'multiline', maxLength: 500 },
  { key: 'authorLabel', label: 'Signed by', type: 'text', maxLength: 40, optional: true },
  { key: 'style', label: 'Style', type: 'select', options: STYLE_OPTIONS },
  sound,
];

const EXPORTS: BlueprintExports = {
  transcript: '{{anchorText}} [{{noteTitle}}: {{noteBody}} {{authorLabel}}]',
  summary: '{{anchorText}}: {{noteTitle}}',
  epubXhtml:
    '<p><strong>{{anchorText}}</strong><sup>*</sup></p><aside class="kn-note" role="note"><h4>{{noteTitle}}</h4><p>{{noteBody}}</p><p><em>{{authorLabel}}</em></p></aside>',
  royalRoadHtml:
    '<p><u>{{anchorText}}</u></p><blockquote><p><strong>{{noteTitle}}</strong></p><p>{{noteBody}}</p><p><i>{{authorLabel}}</i></p></blockquote>',
};

export const MARGIN_NOTE_BLUEPRINTS: GimmickBlueprint[] = [
  {
    ...base,
    id: 'lore-footnote',
    engine: 'margin-note',
    genre: 'fantasy',
    subgenre: 'worldbuilding',
    mood: ['scholarly', 'quiet'],
    tags: ['lore', 'footnote', 'worldbuilding'],
    name: 'Lore Footnote',
    tagline: 'Tap an underlined word to unfold a scholar’s aside.',
    fields: FIELDS,
    defaultProps: {
      anchorText: 'the Ashen Court',
      noteTitle: 'On the Ashen Court',
      noteBody:
        'Founded after the Burning of Vael, its members swear never to speak a name aloud after dusk.',
      authorLabel: 'Archivist Renn',
      style: 'footnote',
      sound: false,
    },
    sampleProps: {
      anchorText: 'moon-glass',
      noteTitle: 'Moon-glass',
      noteBody: 'A pale crystal that hums when something lies nearby.',
      authorLabel: '',
      style: 'lore-card',
    },
    visual: {
      layout: 'footnote',
      ornament: 'minimal',
      accentRole: 'secondary',
      borderStyle: 'none',
      motionPreset: 'fade',
    },
    sound: { patch: 'paper-rustle', gain: 0.3 },
    haptics: 'tap',
    exports: EXPORTS,
  },
  {
    ...base,
    id: 'pov-whisper-note',
    engine: 'margin-note',
    genre: 'romance',
    subgenre: 'inner-voice',
    mood: ['intimate', 'tender'],
    tags: ['whisper', 'thought', 'pov', 'aside'],
    name: 'POV Whisper',
    tagline: 'A private thought hiding behind a single phrase.',
    fields: FIELDS,
    defaultProps: {
      anchorText: 'nothing at all',
      noteTitle: 'What she did not say',
      noteBody:
        'It was everything. It had always been everything, and she was tired of pretending.',
      authorLabel: 'Mara',
      style: 'pov-whisper',
      sound: false,
    },
    sampleProps: {
      anchorText: 'fine',
      noteTitle: 'Not fine',
      noteBody: 'His hand was still warm on her sleeve.',
      authorLabel: 'Elio',
      style: 'scratch-out',
    },
    visual: {
      layout: 'pov-whisper',
      ornament: 'minimal',
      accentRole: 'primary',
      borderStyle: 'none',
      motionPreset: 'fade',
    },
    exports: EXPORTS,
  },
];
