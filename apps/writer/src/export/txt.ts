// Plain-text serializer: no markup at all, chapters separated by blank lines (or form feeds). Pure.
import { stripInlineMarkup } from '../editor/inline-markup.ts';
import type { CompiledBook, ExportOptions } from './book-model.ts';
import { flattenBlocks, type Item } from './flatten.ts';

function itemToTxt(item: Item): string {
  if (item.type === 'break') return item.label ? `* * *\n${item.label}` : '* * *';
  const body = stripInlineMarkup(item.text);
  const spoken = item.speaker ? `${item.speaker}: ${body}` : body;
  return item.bullet ? `• ${spoken}` : spoken;
}

export function toTxt(book: CompiledBook, opts: ExportOptions): string {
  const parts: string[] = [];
  if (opts.titlePage) {
    parts.push(
      [book.title, book.subtitle, book.author ? `by ${book.author}` : '']
        .filter(Boolean)
        .join('\n'),
    );
  }
  if (opts.toc && book.sections.length > 0) {
    parts.push(['Contents', ...book.sections.map((s, i) => `${i + 1}. ${s.title}`)].join('\n'));
  }
  book.sections.forEach((section, i) => {
    if (opts.pageBreaks && (i > 0 || parts.length > 0)) parts.push('\f');
    if (section.showTitle !== false) parts.push(section.title);
    for (const item of flattenBlocks(section.blocks, section.styles, opts.gimmickMode, section.blueprints))
      parts.push(itemToTxt(item));
  });
  return `${parts.join('\n\n')}\n`;
}
