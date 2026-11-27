// Shared field / export-template builders for the batch-B starter blueprints.
import type { BlueprintFieldSpec } from '@kn/core/gimmicks';

export const soundField: BlueprintFieldSpec = {
  key: 'sound',
  label: 'Play sound',
  type: 'boolean',
  optional: true,
};

export const revealFields = (
  mechanism: string,
  options: [string, string][],
  hint: string,
): BlueprintFieldSpec[] => [
  { key: 'prompt', label: 'Prompt', type: 'text', maxLength: 120, help: hint },
  { key: 'label', label: 'Action label', type: 'text', maxLength: 40 },
  { key: 'revealedTitle', label: 'Revealed title', type: 'text', maxLength: 60 },
  { key: 'revealedBody', label: 'Revealed text', type: 'list', minItems: 1, maxItems: 8 },
  {
    key: 'mechanism',
    label: 'Mechanism',
    type: 'select',
    options: options.map(([value, label]) => ({ value, label })),
    help: mechanism,
  },
  soundField,
];

export const REVEAL_OPTIONS: [string, string][] = [
  ['wax-seal', 'Wax seal'],
  ['scratch-off', 'Scratch off'],
  ['biometric-hold', 'Biometric hold'],
  ['fog-wipe', 'Fog wipe'],
];

export const revealExports = {
  transcript: '{{prompt}} [{{revealedTitle}}] {{#each revealedBody}}{{.}} {{/each}}',
  summary: '{{revealedTitle}}: {{prompt}}',
  epubXhtml:
    '<section class="reveal"><p><em>{{prompt}}</em></p><h3>{{revealedTitle}}</h3>{{#each revealedBody}}<p>{{.}}</p>{{/each}}</section>',
  royalRoadHtml:
    '<div style="border:1px solid #8a7a5a;padding:10px"><p><em>{{prompt}}</em></p><p><strong>{{revealedTitle}}</strong></p>{{#each revealedBody}}<p>{{.}}</p>{{/each}}</div>',
};

export const meterFields = (styles: [string, string][]): BlueprintFieldSpec[] => [
  { key: 'label', label: 'Label', type: 'text', maxLength: 40 },
  { key: 'unit', label: 'Unit', type: 'text', maxLength: 8, optional: true },
  { key: 'value', label: 'Value', type: 'number', min: 0, max: 100000, step: 1 },
  { key: 'max', label: 'Maximum', type: 'number', min: 1, max: 100000, step: 1 },
  {
    key: 'threshold',
    label: 'Warning threshold',
    type: 'number',
    min: 0,
    max: 100000,
    step: 1,
    optional: true,
  },
  {
    key: 'items',
    label: 'Extra readings',
    type: 'records',
    optional: true,
    maxItems: 5,
    itemLabel: 'Reading',
    columns: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'value', label: 'Value', type: 'number' },
      { key: 'max', label: 'Maximum', type: 'number' },
    ],
  },
  {
    key: 'style',
    label: 'Style',
    type: 'select',
    options: styles.map(([value, label]) => ({ value, label })),
  },
  soundField,
];

export const METER_STYLES: [string, string][] = [
  ['bars', 'Bars'],
  ['countdown', 'Countdown'],
  ['ekg', 'EKG'],
  ['radar', 'Radar'],
  ['compass', 'Compass'],
];

export const meterExports = {
  transcript: '{{label}}: {{value}} {{unit}} (max {{max}})',
  summary: '{{label}} {{value}}/{{max}}',
  epubXhtml:
    '<aside class="meter" role="group" aria-label="{{label}}"><p><strong>{{label}}</strong>: {{value}} {{unit}} <small>of {{max}}</small></p><ul>{{#each items}}<li>{{name}}: {{value}} / {{max}}</li>{{/each}}</ul></aside>',
  royalRoadHtml:
    '<div style="border:1px solid #888;padding:8px"><p><strong>{{label}}</strong>: {{value}} {{unit}} <small>of {{max}}</small></p><ul>{{#each items}}<li>{{name}}: {{value}} / {{max}}</li>{{/each}}</ul></div>',
};

export const proseFields = (effects: [string, string][]): BlueprintFieldSpec[] => [
  { key: 'text', label: 'Text', type: 'multiline', maxLength: 600 },
  {
    key: 'effect',
    label: 'Effect',
    type: 'select',
    options: effects.map(([value, label]) => ({ value, label })),
  },
  { key: 'emphasisWord', label: 'Emphasised word', type: 'text', maxLength: 30, optional: true },
  soundField,
];

export const PROSE_EFFECTS: [string, string][] = [
  ['shiver', 'Shiver'],
  ['drop-cap', 'Drop cap'],
  ['typewriter', 'Typewriter'],
  ['echo', 'Echo'],
  ['sink', 'Sink'],
  ['pulse', 'Pulse'],
];

export const proseExports = {
  transcript: '{{text}}',
  summary: '{{text}}',
  epubXhtml: '<p class="kinetic">{{text}}</p>',
  royalRoadHtml: '<p>{{text}}</p>',
};
