// Markdown serializer: a chapter, a standalone note, or a merged book. Pure.
import type { InlineRun } from '../editor/inline-markup.ts';
import type { CompiledBook, ExportOptions } from './book-model.ts';
import { flattenBlocks, headingDepth, type Item } from './flatten.ts';
import { italicRuns, markupRuns } from './markup-util.ts';

const escapeMd = (s: string): string => s.replace(/([\\*_`~])/g, '\\$1');

function wrapRun(r: InlineRun): string {
  let s = escapeMd(r.text);
  if (r.highlight) s = `<mark>${s}</mark>`;
  if (r.underline) s = `<u>${s}</u>`;
  if (r.strike) s = `~~${s}~~`;
  if (r.italic) s = `*${s}*`;
  if (r.bold) s = `**${s}**`;
  return s;
}

const inline = (text: string, italic?: boolean): string => {
  const runs = markupRuns(text);
  return (italic ? italicRuns(runs) : runs).map(wrapRun).join('');
};

function itemToMd(item: Item, showTitle: boolean): string {
  if (item.type === 'break') return item.label ? `* * *\n\n*${escapeMd(item.label)}*` : '* * *';
  const body = inline(item.text, item.italic);
  if (item.heading)
    return `${'#'.repeat(Math.min(6, headingDepth(item.heading, showTitle) + 1))} ${body}`;
  const spoken = item.speaker ? `**${escapeMd(item.speaker)}:** ${body}` : body;
  if (item.bullet) return `- ${spoken}`;
  return item.quote ? `> ${spoken}` : spoken;
}

export function toMarkdown(book: CompiledBook, opts: ExportOptions): string {
  const parts: string[] = [];
  if (opts.titlePage) {
    parts.push(`# ${escapeMd(book.title)}`);
    if (book.subtitle) parts.push(`*${escapeMd(book.subtitle)}*`);
    if (book.author) parts.push(`**${escapeMd(book.author)}**`);
  }
  if (opts.toc && book.sections.length > 0) {
    const list = book.sections.map((s, i) => `${i + 1}. ${escapeMd(s.title)}`).join('\n');
    parts.push(`## Contents\n\n${list}`);
  }
  book.sections.forEach((section, i) => {
    const showTitle = section.showTitle !== false;
    if (opts.pageBreaks && (i > 0 || parts.length > 0))
      parts.push('<div style="page-break-after: always;"></div>');
    if (showTitle) parts.push(`## ${escapeMd(section.title)}`);
    for (const item of flattenBlocks(section.blocks, section.styles, opts.gimmickMode, section.blueprints))
      parts.push(itemToMd(item, showTitle));
  });
  return `${parts.join('\n\n')}\n`;
}
