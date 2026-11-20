import type { Block } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { parseDocx } from '../import/docx.ts';
import { DEFAULT_EXPORT_OPTIONS, type CompiledBook } from './book-model.ts';
import { buildDocx } from './docx.ts';
import { textOf, unzipFiles, usesAsyncZip } from './zip.ts';

const id = (n: number): string => `01HZZZZZZZZZZZZZZZZZZZZZ${String(n).padStart(2, '0')}`;
const prose = (n: number, text: string): Block => ({ id: id(n), kind: 'prose', text });

/** Tiny tag-balance checker: every open tag closes in order; declaration/self-closing tolerated. */
function assertWellFormed(xml: string): void {
  const stack: string[] = [];
  const tags = xml
    .replace(/<\?[\s\S]*?\?>/g, '')
    .matchAll(/<(\/?)([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g);
  for (const [, close, name, , self] of tags) {
    if (self) continue;
    if (close) expect(stack.pop()).toBe(name);
    else stack.push(name!);
  }
  expect(stack).toEqual([]);
  expect(xml.replace(/<[^>]*>/g, '')).not.toMatch(/[<>]/);
}

const book = (
  blocks: Block[],
  styles: CompiledBook['sections'][number]['styles'] = {},
): CompiledBook => ({
  title: 'Tom & <Jerry> "Co"',
  author: 'A. Author',
  sections: [{ id: 'c1', title: 'One & Only', blocks, styles, showTitle: false }],
});

describe('buildDocx', () => {
  it('contains exactly the five OPC parts, all well-formed XML', async () => {
    const files = await unzipFiles(
      await buildDocx(book([prose(1, 'Hello')]), DEFAULT_EXPORT_OPTIONS),
    );
    expect(Object.keys(files).sort()).toEqual(
      [
        '[Content_Types].xml',
        '_rels/.rels',
        'word/_rels/document.xml.rels',
        'word/document.xml',
        'word/styles.xml',
      ].sort(),
    );
    for (const data of Object.values(files)) assertWellFormed(textOf(data));
    expect(textOf(files['word/styles.xml']!)).toContain('w:outlineLvl w:val="0"');
  });

  it('escapes & < > in text and titles and strips illegal control characters', async () => {
    const b = book([prose(1, 'a & b < c > d \u0001 e')]);
    const files = await unzipFiles(await buildDocx(b, DEFAULT_EXPORT_OPTIONS));
    const xml = textOf(files['word/document.xml']!);
    expect(xml).toContain('Tom &amp; &lt;Jerry&gt; &quot;Co&quot;');
    expect(xml).toContain('a &amp; b &lt; c &gt; d  e');
    expect(xml).not.toContain('\u0001');
    assertWellFormed(xml);
  });

  it('writes page breaks between chapters and a scene-break paragraph', async () => {
    const b: CompiledBook = {
      ...book([{ id: id(2), kind: 'scene-break' }]),
      sections: [
        { id: 'a', title: 'A', blocks: [{ id: id(2), kind: 'scene-break' }], styles: {} },
        { id: 'b', title: 'B', blocks: [], styles: {} },
      ],
    };
    const xml = textOf(
      (await unzipFiles(await buildDocx(b, DEFAULT_EXPORT_OPTIONS)))['word/document.xml']!,
    );
    expect(xml).toContain('<w:br w:type="page"/>');
    expect(xml).toContain('* * *');
  });

  it('round-trips paragraphs, headings, bold/italic runs and alignment', async () => {
    const blocks = [
      prose(1, 'The Beginning'),
      prose(2, 'She said **loudly** that it was *quiet* & calm.'),
      prose(3, 'Centred line'),
      prose(4, 'Indented paragraph'),
    ];
    const styles = {
      [id(1)]: { heading: 2 as const },
      [id(3)]: { align: 'center' as const },
      [id(4)]: { indent: true },
    };
    const doc = await parseDocx(await buildDocx(book(blocks, styles), DEFAULT_EXPORT_OPTIONS));
    expect(doc.title).toBe('Tom & <Jerry> "Co"');
    const texts = doc.blocks.map((b) => (b.kind === 'prose' ? b.text : ''));
    expect(texts).toEqual([
      'The Beginning',
      'She said **loudly** that it was *quiet* & calm.',
      'Centred line',
      'Indented paragraph',
    ]);
    expect(doc.styles[doc.blocks[0]!.id]?.heading).toBe(2);
    expect(doc.styles[doc.blocks[2]!.id]?.align).toBe('center');
    expect(doc.styles[doc.blocks[3]!.id]?.indent).toBe(true);
  });

  it('streams large books through the async zip path and still unzips', async () => {
    const blocks: Block[] = Array.from({ length: 400 }, (_, i) => ({
      id: `01HZZZZZZZZZZZZZZZZZZ${String(10000 + i)}`,
      kind: 'prose',
      text: `Paragraph ${i} ${'lorem ipsum dolor sit amet '.repeat(8)}`,
    }));
    const big = book(blocks);
    const out = await buildDocx(big, DEFAULT_EXPORT_OPTIONS);
    const xml = textOf((await unzipFiles(out))['word/document.xml']!);
    expect(xml.length).toBeGreaterThan(50 * 1024);
    expect(usesAsyncZip({ 'word/document.xml': new TextEncoder().encode(xml) })).toBe(true);
    expect(await parseDocx(out)).toHaveProperty('blocks.length', 400);
  });
});
