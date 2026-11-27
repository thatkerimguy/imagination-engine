import { describe, expect, it } from 'vitest';
import {
  ENGINE_IDS,
  renderBlueprintExport,
  renderTemplate,
  guardBlueprint,
  resolveBlueprintProps,
  type GimmickBlueprint,
} from './index.ts';
import { validateBlueprint } from './validate.ts';

const sample = (): GimmickBlueprint => ({
  id: 'system-notification',
  version: 1,
  engine: 'frame-hud',
  genre: 'litrpg',
  subgenre: 'system',
  mood: ['triumphant'],
  tags: ['hud', 'level-up'],
  name: 'System Notification',
  tagline: 'A crisp system window.',
  tier: 'free',
  fields: [
    { key: 'title', label: 'Title', type: 'text', maxLength: 40 },
    { key: 'lines', label: 'Lines', type: 'list', minItems: 1, maxItems: 6 },
    {
      key: 'tone',
      label: 'Tone',
      type: 'select',
      options: [
        { value: 'info', label: 'Info' },
        { value: 'alert', label: 'Alert' },
      ],
    },
    { key: 'level', label: 'Level', type: 'number', min: 1, max: 99, step: 1 },
    { key: 'sound', label: 'Chime', type: 'boolean' },
  ],
  defaultProps: { title: 'Level Up', lines: ['STR +2'], tone: 'info', level: 5, sound: true },
  sampleProps: { title: 'Skill Gained' },
  visual: {
    layout: 'system',
    ornament: 'inherit',
    accentRole: 'primary',
    borderStyle: 'hairline',
    motionPreset: 'sweep',
  },
  sound: { patch: 'chime', gain: 0.6 },
  haptics: 'tap',
  exports: {
    transcript: '[{{title}}] {{#each lines}}{{.}}; {{/each}}',
    summary: '{{title}} (Lv {{level}})',
    epubXhtml:
      '<aside class="hud"><p><strong>{{title}}</strong></p><ul>{{#each lines}}<li>{{.}}</li>{{/each}}</ul></aside>',
    royalRoadHtml: '<div style="border:1px solid #888"><strong>{{title}}</strong></div>',
  },
});

describe('validateBlueprint', () => {
  it('accepts a well-formed blueprint and lists all 14 engines', () => {
    expect(ENGINE_IDS).toHaveLength(14);
    expect(validateBlueprint(sample())).toMatchObject({ ok: true });
  });

  it.each([
    ['script tag', (b: GimmickBlueprint) => (b.exports.epubXhtml = '<script>alert(1)</script>')],
    ['javascript url', (b: GimmickBlueprint) => (b.tagline = 'javascript:alert(1)')],
    [
      'event handler',
      (b: GimmickBlueprint) => (b.exports.royalRoadHtml = '<p onclick="x()">a</p>'),
    ],
    ['external url', (b: GimmickBlueprint) => (b.defaultProps.title = 'see https://evil.test')],
    [
      'css fetch',
      (b: GimmickBlueprint) => (b.exports.royalRoadHtml = '<p style="background:url(x)">'),
    ],
    ['blocked tag', (b: GimmickBlueprint) => (b.exports.epubXhtml = '<img src="x">')],
    ['unknown tag', (b: GimmickBlueprint) => (b.exports.epubXhtml = '<marquee>hi</marquee>')],
    ['bad attribute', (b: GimmickBlueprint) => (b.exports.epubXhtml = '<p id="x" href="y">a</p>')],
  ])('rejects %s', (_, mutate) => {
    const b = sample();
    mutate(b);
    expect(validateBlueprint(b).ok).toBe(false);
  });

  it('rejects structural problems', () => {
    expect(validateBlueprint({ ...sample(), engine: 'rocket' }).ok).toBe(false);
    expect(validateBlueprint({ ...sample(), id: 'Not A Slug' }).ok).toBe(false);
    const b = sample();
    b.defaultProps.level = 500;
    expect(validateBlueprint(b)).toMatchObject({ ok: false });
    const c = sample();
    c.sampleProps = { ghost: 'x' };
    expect(validateBlueprint(c).ok).toBe(false);
    const d = sample();
    d.fields.push({ key: 'title', label: 'Again', type: 'boolean' });
    expect(validateBlueprint(d).ok).toBe(false);
  });
});

describe('resolveBlueprintProps', () => {
  it('merges over defaults and drops unknown keys', () => {
    const r = resolveBlueprintProps(sample(), { title: 'Hi', bogus: 1, level: 9 });
    expect(r).toEqual({
      ok: true,
      props: { title: 'Hi', lines: ['STR +2'], tone: 'info', level: 9, sound: true },
    });
  });

  it('reports invalid values', () => {
    expect(resolveBlueprintProps(sample(), { tone: 'shout' }).ok).toBe(false);
    expect(resolveBlueprintProps(sample(), { lines: [] }).ok).toBe(false);
  });
});

describe('renderBlueprintExport', () => {
  it('renders plain text formats without escaping', () => {
    const b = sample();
    expect(renderBlueprintExport(b, { lines: ['A', 'B & C'] }, 'transcript')).toBe(
      '[Level Up] A; B & C;',
    );
    expect(renderBlueprintExport(b, {}, 'summary')).toBe('Level Up (Lv 5)');
  });

  it('escapes every value in HTML formats', () => {
    const out = renderBlueprintExport(
      sample(),
      { title: '<b>"x"</b>', lines: ['<i>&</i>'] },
      'epubXhtml',
    );
    expect(out).toContain('&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
    expect(out).toContain('<li>&lt;i&gt;&amp;&lt;/i&gt;</li>');
    expect(out).not.toContain('<b>');
  });

  it('supports item numbers and empty lists', () => {
    expect(renderTemplate('{{#each xs}}{{@n}}.{{.}} {{/each}}', { xs: ['a', 'b'] }, false)).toBe(
      '1.a 2.b',
    );
    expect(renderTemplate('[{{#each xs}}{{.}}{{/each}}]', { xs: [] }, true)).toBe('[]');
    expect(renderTemplate('{{missing}}!', {}, true)).toBe('!');
  });
});

describe('object lists, sanitising and the reader guard', () => {
  it('renders {{field}} inside each over object lists, escaped in HTML', () => {
    const msgs = [
      { sender: 'K9', text: 'a<b' },
      { sender: 'Ops', text: 'ok' },
    ];
    expect(renderTemplate('{{#each m}}{{sender}}: {{text}}\n{{/each}}', { m: msgs }, false)).toBe(
      'K9: a<b\nOps: ok',
    );
    expect(renderTemplate('{{#each m}}<p>{{text}}</p>{{/each}}', { m: msgs }, true)).toBe(
      '<p>a&lt;b</p><p>ok</p>',
    );
  });

  it('strips script/style from HTML templates and collapses plain whitespace', () => {
    expect(renderTemplate('<p>a</p><script>x()</script><style>p{}</style>', {}, true)).toBe(
      '<p>a</p>',
    );
    expect(renderTemplate('  a   b \n\n\n\n c ', {}, false)).toBe('a b\n\nc');
  });

  it('guardBlueprint accepts valid data and rejects hostile or malformed data', () => {
    expect(guardBlueprint(sample()).ok).toBe(true);
    expect(guardBlueprint({ ...sample(), engine: 'nope' }).ok).toBe(false);
    const b = sample();
    b.defaultProps.title = '<script>steal()</script>';
    expect(guardBlueprint(b).ok).toBe(false);
    expect(guardBlueprint('x').ok).toBe(false);
  });

  it('validates records fields', () => {
    const b = sample();
    b.fields.push({
      key: 'msgs',
      label: 'Messages',
      type: 'records',
      columns: [
        { key: 'sender', label: 'Sender', type: 'text' },
        { key: 'time', label: 'Time', type: 'text', optional: true },
      ],
    });
    b.defaultProps.msgs = [{ sender: 'A' }];
    expect(validateBlueprint(b).ok).toBe(true);
    b.defaultProps.msgs = [{ time: '1' }];
    expect(validateBlueprint(b).ok).toBe(false);
  });
});
