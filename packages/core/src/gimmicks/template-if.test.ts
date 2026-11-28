import { describe, expect, it } from 'vitest';
import { isTruthy, renderTemplate, sanitizeStyles, securityIssues, styleIssues } from './index.ts';

describe('{{#if}} conditionals', () => {
  it('renders the section only for present values', () => {
    const t = '{{title}}{{#if sub}} / {{sub}}{{/if}}';
    expect(renderTemplate(t, { title: 'A', sub: 'B' }, false)).toBe('A / B');
    expect(renderTemplate(t, { title: 'A', sub: '  ' }, false)).toBe('A');
    expect(renderTemplate(t, { title: 'A' }, false)).toBe('A');
  });

  it('supports {{else}}', () => {
    const t = '{{#if n}}n={{n}}{{else}}none{{/if}}';
    expect(renderTemplate(t, { n: 3 }, false)).toBe('n=3');
    expect(renderTemplate(t, { n: 0 }, false)).toBe('none');
  });

  it('nests inside and around {{#each}}', () => {
    const msgs: Record<string, string>[] = [{ s: 'A', t: '09:00' }, { s: 'B' }];
    const inner = '{{#each m}}{{s}}{{#if t}} · {{t}}{{/if}};{{/each}}';
    expect(renderTemplate(inner, { m: msgs }, false)).toBe('A · 09:00;B;');
    const outer = '{{#if xs}}[{{#each xs}}{{#if .}}{{.}}{{/if}}{{/each}}]{{/if}}';
    expect(renderTemplate(outer, { xs: ['a', '', 'b'] }, false)).toBe('[ab]');
    expect(renderTemplate(outer, { xs: [] }, false)).toBe('');
  });

  it('degrades unbalanced tags to nothing instead of throwing', () => {
    expect(renderTemplate('a{{#if x}}b', { x: 'y' }, false)).toBe('ab');
    expect(renderTemplate('a{{/if}}b{{else}}c', {}, false)).toBe('abc');
  });

  it('truthiness follows the documented rules', () => {
    expect([' x', 1, true, ['a']].every(isTruthy)).toBe(true);
    expect(['', ' ', 0, Number.NaN, false, [], null, undefined, {}].some(isTruthy)).toBe(false);
  });
});

describe('export inline-style allowlist', () => {
  it('accepts the Royal Road System box declarations', () => {
    const css =
      'border-collapse:collapse;width:100%;background:#0c2340;color:#eef6ff;' +
      'border:2px solid #3b82f6;margin:1em 0;padding:8px 12px;font-weight:700;text-align:left';
    expect(styleIssues(css)).toEqual([]);
  });

  it('rejects positioning, fetches and script', () => {
    expect(styleIssues('position:fixed')).toHaveLength(1);
    expect(styleIssues('background:url(x.png)')).toHaveLength(1);
    expect(styleIssues('width:expression(alert(1))')).toHaveLength(1);
  });

  it('flags template CSS outside the allowlist at scan time', () => {
    const bp = { exports: { royalRoadHtml: '<table style="position:absolute"></table>' } };
    expect(securityIssues(bp).join()).toMatch(/style property position/);
  });

  it('strips unsafe interpolated declarations after render', () => {
    const out = renderTemplate('<td style="color:{{c}}">x</td>', { c: 'red;position:fixed' }, true);
    expect(out).toBe('<td style="color:red">x</td>');
    expect(sanitizeStyles('<p style="top:0">a</p>')).toBe('<p>a</p>');
  });
});
