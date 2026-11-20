// DOCX import: unzip, read `word/document.xml` with a small tolerant tokenizer (no DOM), turn
// paragraphs into prose blocks and runs back into the writer's inline markup.
import type { InlineRun } from '../editor/inline-markup.ts';
import { runsToMarkup } from '../export/markup-util.ts';
import { textOf, unzipFiles } from '../export/zip.ts';
import { buildImported, isSceneBreakLine, type ImportedDoc, type ImportedItem } from './build.ts';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith('#')) return String.fromCodePoint(parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? m;
  });
}

const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\bw:${name}="([^"]*)"`).exec(tag)?.[1];

/** `<w:b/>` is on; `<w:b w:val="0|false|none"/>` is off; absent is off. */
function flag(rpr: string, name: string): boolean {
  const m = new RegExp(`<w:${name}(\\s[^>]*)?/?>`).exec(rpr);
  if (!m) return false;
  const v = attr(m[0], 'val');
  return !(v === '0' || v === 'false' || v === 'none');
}

function runOf(inner: string): InlineRun | null {
  const rpr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(inner)?.[1] ?? '';
  const body = inner.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/, '');
  const text = [
    ...body.matchAll(/<w:t(?:\s[^>]*[^/>])?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br(?:\s[^>]*)?\/>/g),
  ]
    .map((m) =>
      m[0].startsWith('<w:t>') || m[0].startsWith('<w:t ')
        ? decodeXml(m[1] ?? '')
        : m[0].startsWith('<w:tab')
          ? '\t'
          : /w:type="page"/.test(m[0])
            ? ''
            : ' ',
    )
    .join('');
  if (!text) return null;
  return {
    text,
    bold: flag(rpr, 'b'),
    italic: flag(rpr, 'i'),
    underline: flag(rpr, 'u'),
    strike: flag(rpr, 'strike'),
    highlight: flag(rpr, 'highlight'),
  };
}

type Style = NonNullable<Extract<ImportedItem, { text: string }>['style']>;

function paragraph(xml: string): { item: ImportedItem | null; title?: string } {
  const ppr = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(xml)?.[1] ?? '';
  const body = xml.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, '');
  const runs = [...body.matchAll(/<w:r(?:\s[^>]*[^/>])?>([\s\S]*?)<\/w:r>/g)]
    .map((m) => runOf(m[1] ?? ''))
    .filter((r): r is InlineRun => r !== null);
  let text = runsToMarkup(runs);
  if (!text.trim()) return { item: null };
  const pStyle = attr(/<w:pStyle\b[^>]*>/.exec(ppr)?.[0] ?? '', 'val') ?? '';
  if (/^title$/i.test(pStyle))
    return {
      item: null,
      title: runs
        .map((r) => r.text)
        .join('')
        .trim(),
    };
  if (/^subtitle$/i.test(pStyle)) return { item: null };
  const style: Style = {};
  const h = /^heading\s?([1-9])$/i.exec(pStyle);
  if (h) style.heading = Math.min(3, Number(h[1])) as 1 | 2 | 3;
  if (/^quote$/i.test(pStyle)) style.quote = true;
  const jc = attr(/<w:jc\b[^>]*>/.exec(ppr)?.[0] ?? '', 'val');
  const align = jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : undefined;
  if (align) style.align = align;
  if (jc === 'left' || jc === 'start') style.align = 'left';
  if (Number(attr(/<w:ind\b[^>]*>/.exec(ppr)?.[0] ?? '', 'firstLine') ?? 0) > 0)
    style.indent = true;
  if (/<w:numPr>/.test(ppr)) style.list = 'bullet';
  if (text.startsWith('• ')) {
    text = text.slice(2);
    style.list = 'bullet';
  }
  const plain = runs.map((r) => r.text).join('');
  if (isSceneBreakLine(plain)) return { item: { scene: true } };
  return { item: { text, ...(Object.keys(style).length ? { style } : {}) } };
}

export function parseDocxXml(xml: string, fallbackTitle?: string): ImportedDoc {
  const items: ImportedItem[] = [];
  let title = fallbackTitle;
  const paras = xml.match(/<w:p(?:\s[^>]*[^/>])?>[\s\S]*?<\/w:p>/g) ?? [];
  for (const p of paras) {
    const r = paragraph(p);
    if (r.title) title = r.title;
    if (r.item) items.push(r.item);
  }
  return buildImported(title, items);
}

export async function parseDocx(bytes: Uint8Array, fallbackTitle?: string): Promise<ImportedDoc> {
  const files = await unzipFiles(bytes);
  const doc = files['word/document.xml'];
  if (!doc) throw new Error('This is not a Word (.docx) document.');
  return parseDocxXml(textOf(doc), fallbackTitle);
}
