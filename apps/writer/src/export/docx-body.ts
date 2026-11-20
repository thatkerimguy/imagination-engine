// Book → WordprocessingML body: Title / Heading1–3 / alignment / first-line indent / page breaks.
import { stripInlineMarkup } from '../editor/inline-markup.ts';
import type { CompiledBook, ExportOptions } from './book-model.ts';
import { flattenBlocks, headingDepth, type Item } from './flatten.ts';
import { italicRuns, markupRuns } from './markup-util.ts';
import { PAGE_BREAK, paraXml } from './ooxml.ts';

/** First-line indent for an indented paragraph (0.3 inch). */
export const FIRST_LINE = 432;

const plain = (text: string, over: { bold?: boolean; italic?: boolean } = {}) => ({
  text,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  highlight: false,
  ...over,
});

function itemXml(item: Item, showTitle: boolean): string {
  if (item.type === 'break') {
    const label = item.label
      ? paraXml([plain(item.label, { italic: true })], { align: 'center' })
      : '';
    return paraXml([plain('* * *')], { align: 'center' }) + label;
  }
  const base = markupRuns(item.text);
  let runs = item.italic ? italicRuns(base) : base;
  if (item.speaker) runs = [plain(`${item.speaker}: `, { bold: true }), ...runs];
  if (item.bullet) runs = [plain('• '), ...runs];
  if (item.heading) {
    const level = Math.min(3, headingDepth(item.heading, showTitle));
    return paraXml(runs, {
      style: `Heading${level}`,
      ...(item.align ? { align: item.align } : {}),
    });
  }
  return paraXml(runs, {
    ...(item.quote ? { style: 'Quote' } : {}),
    ...(item.align ? { align: item.align } : {}),
    ...(item.indent ? { firstLine: FIRST_LINE } : {}),
  });
}

export function docxBody(book: CompiledBook, opts: ExportOptions): string {
  const out: string[] = [];
  if (opts.titlePage) {
    out.push(paraXml([plain(book.title)], { style: 'Title' }));
    if (book.subtitle) out.push(paraXml([plain(book.subtitle)], { style: 'Subtitle' }));
    if (book.author) out.push(paraXml([plain(book.author)], { style: 'Subtitle' }));
    out.push(PAGE_BREAK);
  }
  if (opts.toc && book.sections.length > 0) {
    out.push(paraXml([plain('Contents', { bold: true })], { style: 'Heading2' }));
    book.sections.forEach((s, i) =>
      out.push(paraXml([plain(`${i + 1}. ${stripInlineMarkup(s.title)}`)])),
    );
    out.push(PAGE_BREAK);
  }
  book.sections.forEach((section, i) => {
    const showTitle = section.showTitle !== false;
    if (opts.pageBreaks && i > 0) out.push(PAGE_BREAK);
    if (showTitle) out.push(paraXml([plain(section.title)], { style: 'Heading1' }));
    for (const item of flattenBlocks(section.blocks, section.styles, opts.gimmickMode))
      out.push(itemXml(item, showTitle));
  });
  return out.join('');
}
