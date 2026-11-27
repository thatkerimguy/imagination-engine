import type { Block } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../import/markdown.ts';
import { parseTxt } from '../import/txt.ts';
import { DEFAULT_EXPORT_OPTIONS, type CompiledBook, type ExportOptions } from './book-model.ts';
import { toHtml } from './html.ts';
import { toMarkdown } from './markdown.ts';
import { toTxt } from './txt.ts';

const blocks: Block[] = [
  { id: '01HZZZZZZZZZZZZZZZZZZZZZ01', kind: 'prose', text: 'A **bold** & <b>tag</b>' },
  { id: '01HZZZZZZZZZZZZZZZZZZZZZ02', kind: 'dialogue', speaker: 'Ana', text: 'Hi' },
  { id: '01HZZZZZZZZZZZZZZZZZZZZZ03', kind: 'scene-break' },
  {
    id: '01HZZZZZZZZZZZZZZZZZZZZZ04',
    kind: 'module',
    moduleId: 'chat-thread',
    moduleVersion: 1,
    props: {
      blueprintId: 'cyberbrain-link',
      channel: 'KESTREL-9',
      encryption: 'aes-q',
      messages: [{ sender: 'KESTREL-9', text: 'Link established.' }],
    },
  },
  {
    id: '01HZZZZZZZZZZZZZZZZZZZZZ05',
    kind: 'module',
    moduleId: 'bespoke-3d',
    moduleVersion: 1,
    props: { blueprintId: 'dice-throw-3d' },
  },
];
const book: CompiledBook = {
  title: 'T & T',
  author: 'Me',
  sections: [{ id: 'c', title: 'One', blocks, styles: {} }],
};
const opts = (o: Partial<ExportOptions> = {}): ExportOptions => ({
  ...DEFAULT_EXPORT_OPTIONS,
  ...o,
});

describe('serializers', () => {
  it('html is a complete escaped document', () => {
    const html = toHtml(book, opts());
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('&lt;b&gt;tag&lt;/b&gt;');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('@page { margin: 48px; }');
    expect(html).not.toMatch(/height:\s*100%/);
  });

  it('gimmick modes: transcript, summary, omit', () => {
    expect(toTxt(book, opts())).toContain('KESTREL-9: Link established.');
    expect(toTxt(book, opts({ gimmickMode: 'summary' }))).toMatch(/\[3D Dice Throw: .*\]/);
    const omitted = toTxt(book, opts({ gimmickMode: 'omit' }));
    expect(omitted).not.toContain('Link established');
    expect(omitted).not.toContain('Dice');
  });

  it('markdown keeps markup and heading levels', () => {
    const md = toMarkdown(
      {
        ...book,
        sections: [{ ...book.sections[0]!, styles: { [blocks[0]!.id]: { heading: 1 } } }],
      },
      opts({ toc: true }),
    );
    expect(md).toContain('# T & T');
    expect(md).toContain('## Contents');
    expect(md).toContain('### A **bold**');
  });
});

describe('text / markdown import', () => {
  it('splits paragraphs and escapes literal markup', () => {
    const doc = parseTxt('One *star*\nstill one\n\n* * *\n\nTwo', 'T');
    expect(doc.blocks.map((b) => b.kind)).toEqual(['prose', 'scene-break', 'prose']);
    expect(doc.blocks[0]).toMatchObject({ text: 'One \\*star\\* still one' });
  });

  it('maps markdown headings, emphasis and lists', () => {
    const doc = parseMarkdown('# Title\n\n## Part\n\nSome _it_ and __bo__.\n\n- item');
    expect(doc.title).toBe('Title');
    expect(doc.styles[doc.blocks[0]!.id]?.heading).toBe(2);
    expect(doc.blocks[1]).toMatchObject({ text: 'Some *it* and **bo**.' });
    expect(doc.styles[doc.blocks[2]!.id]?.list).toBe('bullet');
  });
});
