// artifact-doc starter blueprints.
import type { BlueprintExports, BlueprintFieldSpec, GimmickBlueprint } from '@kn/core/gimmicks';
import { base, opts, list, text } from '../frame-hud/bp-kit.ts';

const DOC_FIELDS: BlueprintFieldSpec[] = [
  {
    key: 'docType',
    label: 'Document',
    type: 'select',
    options: opts('dossier', 'diary', 'newsprint', 'ticket', 'contract'),
  },
  text('referenceNo', 'Reference number'),
  text('stamp', 'Stamp'),
  text('heading', 'Heading'),
  { key: 'meta', label: 'Details', type: 'list', itemLabel: 'Detail', maxItems: 8 },
  list('body', 'Paragraphs', 'Paragraph'),
  text('signature', 'Signature'),
];
const docExports: BlueprintExports = {
  transcript:
    '{{heading}} ({{referenceNo}})\n{{#each meta}}{{.}}\n{{/each}}{{#each body}}{{.}}\n{{/each}}{{signature}}',
  summary: '{{heading}} {{referenceNo}}',
  epubXhtml:
    '<section class="kn-doc"><header><small>{{referenceNo}}</small><h3>{{heading}}</h3></header>{{#each meta}}<p><small>{{.}}</small></p>{{/each}}{{#each body}}<p>{{.}}</p>{{/each}}<footer><em>{{signature}}</em> <strong>{{stamp}}</strong></footer></section>',
  royalRoadHtml:
    '<blockquote><p><small>{{referenceNo}}</small></p><p><b>{{heading}}</b></p>{{#each body}}<p>{{.}}</p>{{/each}}<p><i>{{signature}}</i> <b>{{stamp}}</b></p></blockquote>',
};

export const ARTIFACT_DOC_BLUEPRINTS: GimmickBlueprint[] = [
  {
    ...base,
    id: 'police-dossier',
    engine: 'artifact-doc',
    genre: 'noir',
    subgenre: 'police-procedural',
    mood: ['gritty', 'cold'],
    tags: ['dossier', 'case-file', 'stamp'],
    name: 'Police Dossier',
    tagline: 'A case file with a stamp that lands on the page.',
    fields: DOC_FIELDS,
    defaultProps: {
      docType: 'dossier',
      referenceNo: 'CASE 1947-0312',
      stamp: 'Open',
      heading: 'Harbor District Disappearance',
      meta: ['Filed: 12 March', 'Officer: Reyes', 'Status: Unresolved'],
      body: [
        'Victim last seen leaving the Marlow Hotel at 21:40.',
        'Witnesses disagree on the coat colour.',
      ],
      signature: 'Det. A. Reyes',
    },
    sampleProps: {
      docType: 'dossier',
      referenceNo: 'CASE 1947-0488',
      stamp: 'Cold',
      heading: 'The Lantern Street Fire',
      meta: ['Filed: 2 April', 'Status: Cold'],
      body: ['No accelerant was found. No survivors were questioned.'],
      signature: 'Sgt. P. Doyle',
    },
    visual: {
      layout: 'dossier',
      ornament: 'inherit',
      surface: 'paper-grain',
      accentRole: 'warning',
      borderStyle: 'hairline',
      motionPreset: 'stamp',
    },
    sound: { patch: 'paper-rustle', gain: 0.5 },
    haptics: 'tap',
    exports: docExports,
  },
  {
    ...base,
    id: 'torn-diary',
    engine: 'artifact-doc',
    genre: 'horror',
    subgenre: 'found-document',
    mood: ['intimate', 'haunted'],
    tags: ['diary', 'journal', 'torn-page'],
    name: 'Torn Diary Page',
    tagline: 'A ruled diary page with a ragged edge.',
    fields: DOC_FIELDS,
    defaultProps: {
      docType: 'diary',
      referenceNo: 'Page 41',
      stamp: '',
      heading: 'October 3rd',
      meta: ['Rain again'],
      body: [
        'I heard the scratching again last night. Under the floor, I think.',
        'Father says it is only the pipes.',
      ],
      signature: 'E.',
    },
    sampleProps: {
      docType: 'diary',
      referenceNo: 'Page 58',
      stamp: '',
      heading: 'October 19th',
      meta: ['No rain'],
      body: ['The scratching has stopped. That is worse.'],
      signature: 'E.',
    },
    visual: {
      layout: 'diary',
      ornament: 'torn-edge',
      surface: 'parchment',
      accentRole: 'neutral',
      borderStyle: 'none',
      motionPreset: 'fade',
    },
    exports: docExports,
  },
];
