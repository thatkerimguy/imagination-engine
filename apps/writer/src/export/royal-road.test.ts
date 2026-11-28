// Royal Road exporter: fragment shape, escaping, blueprint export templates, cue fallbacks.
import { readFileSync } from 'node:fs';
import type { Block, ModuleBlock } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { STARTER_BLUEPRINT_LIST, starterBlueprint } from '@kn/engines/blueprints';
import { DEFAULT_EXPORT_OPTIONS, type CompiledBook, type ExportOptions } from './book-model.ts';
import { buildRoyalRoadHtml } from './royal-road.ts';

const ID = '01HZZZZZZZZZZZZZZZZZZZZZZZ';
const legacy = (moduleId: string, props: Record<string, unknown> = {}): ModuleBlock => ({
  id: ID,
  kind: 'module',
  moduleId,
  moduleVersion: 1,
  props,
});
const cue = (blueprintId: string, props: Record<string, unknown> = {}): ModuleBlock => {
  const bp = starterBlueprint(blueprintId)!;
  return {
    id: ID,
    kind: 'module',
    moduleId: bp.engine,
    moduleVersion: 1,
    props: { blueprintId, ...bp.defaultProps, ...props },
  };
};

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

  it('renders a cue through its blueprint royalRoadHtml template, escaping every value', () => {
    const html = buildRoyalRoadHtml(
      book([cue('system-notification', { title: '<b onclick="x">', lines: ['<img src=x>'] })]),
      opts(),
    );
    expect(html).toContain(
      '<table style="border-collapse:collapse;width:100%;background:#0c2340;color:#eef6ff;border:2px solid #3b82f6;margin:1em 0"><tbody>',
    );
    expect(html).toContain('[SYSTEM NOTIFICATION] · NEW</td></tr>');
    expect(html).toContain('&lt;b onclick=&quot;x&quot;&gt;');
    expect(html).toContain('>&lt;img src=x&gt;</td></tr>');
    expect(html).not.toMatch(/<(img|script|style)\b|class=|javascript:/i);
    // The empty footer row is omitted by {{#if footer}}, not left as an empty cell.
    expect(html).not.toContain('font-style:italic');
  });

  it('the System box is driven by the blueprint template, not by exporter code', () => {
    const src = readFileSync(new URL('./royal-road.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/system-notification|moduleId\s*===/);
  });

  it('every starter blueprint exports paste-ready HTML with no script / style / class', () => {
    for (const bp of STARTER_BLUEPRINT_LIST) {
      const html = buildRoyalRoadHtml(book([cue(bp.id)], false), opts({ titlePage: false }));
      expect(html.trim().length, bp.id).toBeGreaterThan(10);
      expect(html, bp.id).not.toMatch(/<(script|style)|class=|on\w+=/i);
    }
  });

  it('summary mode prints one italic line; omit prints nothing; pre-v2 blocks fall back', () => {
    const c = cue('gaslight-rewrite');
    const summary = buildRoyalRoadHtml(book([c]), opts({ gimmickMode: 'summary' }));
    expect(summary).toMatch(/<p><em>\[Gaslight Rewrite: .+\]<\/em><\/p>/);
    const omitted = buildRoyalRoadHtml(
      book([c, legacy('litrpg-system-box')]),
      opts({ gimmickMode: 'omit' }),
    );
    expect(omitted).not.toContain('<blockquote');
    expect(omitted).not.toContain('<em>');
    expect(buildRoyalRoadHtml(book([legacy('litrpg-system-box')]), opts())).toContain('<p><em>');
  });
});
