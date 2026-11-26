// Royal Road exporter: fragment shape, escaping, LitRPG tables, cue fallbacks.
import type { Block, ModuleBlock } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { getWriterModule } from '../modules/registry.ts';
import { DEFAULT_EXPORT_OPTIONS, type CompiledBook, type ExportOptions } from './book-model.ts';
import { buildRoyalRoadHtml } from './royal-road.ts';

const ID = '01HZZZZZZZZZZZZZZZZZZZZZZZ';
const mod = (moduleId: string, props: Record<string, unknown> = {}): ModuleBlock => ({
  id: ID,
  kind: 'module',
  moduleId,
  moduleVersion: 1,
  props: { ...getWriterModule(moduleId)!.schema.defaults, ...props },
});

const book = (blocks: Block[], showTitle = true): CompiledBook => ({
  title: 'Tom & "Jerry"',
  author: 'A. Author',
  sections: [{ id: 'c1', title: 'Ch <1>', blocks, styles: {}, showTitle }],
});
const prose = (text: string): Block => ({ id: ID, kind: 'prose', text }) as Block;
const opts = (o: Partial<ExportOptions> = {}): ExportOptions => ({
  ...DEFAULT_EXPORT_OPTIONS,
  ...o,
});

describe('buildRoyalRoadHtml', () => {
  it('is a bare fragment with no script/style/html wrapper, even for hostile prose', () => {
    const html = buildRoyalRoadHtml(
      book([prose('<script>alert(1)</script> & <style>x</style>')]),
      opts(),
    );
    expect(html).not.toMatch(/<(script|style|html|head|body)/i);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &lt;style&gt;');
    expect(html).toContain('<h1>Tom &amp; &quot;Jerry&quot;</h1>');
    expect(html).toContain('<h2>Ch &lt;1&gt;</h2>');
  });

  it('renders inline markup, titles and scene breaks', () => {
    const html = buildRoyalRoadHtml(
      book(
        [
          prose('**b** *i* ++u++ ~~s~~'),
          { id: ID, kind: 'scene-break' } as Block,
          { id: ID, kind: 'dialogue', speaker: 'Rin', text: 'Hi' } as Block,
        ],
        false,
      ),
      opts({ titlePage: false }),
    );
    expect(html).toContain('<p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s></p>');
    expect(html).toContain('<hr>');
    expect(html).toContain('<p><strong>Rin:</strong> Hi</p>');
    expect(html).not.toContain('<h2>');
    expect(html).not.toContain('class=');
  });

  it('turns a System Box into an inline-styled table with the variant accent', () => {
    const skill = buildRoyalRoadHtml(
      book([mod('litrpg-system-box', { variant: 'skill' })]),
      opts(),
    );
    expect(skill).toContain(
      '<table style="border-collapse:collapse;width:100%;background:#0c2340;color:#eef6ff;border:2px solid #3b82f6;margin:1em 0;">',
    );
    expect(skill).toContain('<td style="padding:4px 12px;">STR +3</td>');
    expect(skill).toContain('[SYSTEM NOTIFICATION]<br>Class Evolution Unlocked');
    const accents = { warning: '#dc2626', 'level-up': '#f59e0b', quest: '#10b981' };
    for (const [variant, hex] of Object.entries(accents))
      expect(buildRoyalRoadHtml(book([mod('litrpg-system-box', { variant })]), opts())).toContain(
        `border:2px solid ${hex};`,
      );
  });

  it('escapes System Box text and never emits author tags', () => {
    const html = buildRoyalRoadHtml(
      book([mod('litrpg-system-box', { title: '<b onclick="x">', lines: ['<img src=x>'] })]),
      opts(),
    );
    expect(html).toContain('&lt;b onclick=&quot;x&quot;&gt;');
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).not.toContain('<img');
  });

  it('renders other cues as italic paragraphs and honours omit', () => {
    const cue = mod('pt-gaslight-edit');
    const html = buildRoyalRoadHtml(book([cue]), opts());
    expect(html).toContain('<p><em>On a second look it reads:');
    const omitted = buildRoyalRoadHtml(
      book([cue, mod('litrpg-system-box')]),
      opts({ gimmickMode: 'omit' }),
    );
    expect(omitted).not.toContain('On a second look');
    expect(omitted).not.toContain('<table');
  });

  it('still renders the System Box table in summary mode', () => {
    const html = buildRoyalRoadHtml(
      book([mod('litrpg-system-box')]),
      opts({ gimmickMode: 'summary' }),
    );
    expect(html).toContain('<table');
  });
});
