// HTML serializer: a complete, standalone `<!DOCTYPE html>` book with clean typography. Also the
// source for the PDF / print path. Pure.
import type { InlineRun } from '../editor/inline-markup.ts';
import type { CompiledBook, ExportOptions } from './book-model.ts';
import { flattenBlocks, headingDepth, type Item } from './flatten.ts';
import { BOOK_CSS } from './html-css.ts';
import { italicRuns, markupRuns } from './markup-util.ts';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapRun(r: InlineRun): string {
  let s = escapeHtml(r.text).replace(/\n/g, '<br>');
  if (r.fg) s = `<span style="color:${r.fg}">${s}</span>`;
  if (r.highlight) s = `<mark>${s}</mark>`;
  if (r.underline) s = `<u>${s}</u>`;
  if (r.strike) s = `<s>${s}</s>`;
  if (r.italic) s = `<em>${s}</em>`;
  if (r.bold) s = `<strong>${s}</strong>`;
  return s;
}

const inline = (text: string, italic?: boolean): string => {
  const runs = markupRuns(text);
  return (italic ? italicRuns(runs) : runs).map(wrapRun).join('');
};

function itemToHtml(item: Item, showTitle: boolean): string {
  if (item.type === 'break') {
    const label = item.label ? `<p class="scene-label">${escapeHtml(item.label)}</p>` : '';
    return `<p class="scene-break">* * *</p>${label}`;
  }
  const body = inline(item.text, item.italic);
  if (item.heading) {
    const n = Math.min(6, headingDepth(item.heading, showTitle) + 1);
    return `<h${n}>${body}</h${n}>`;
  }
  const classes = [
    item.align,
    item.indent ? 'indent' : '',
    item.quote ? 'quote' : '',
    item.bullet ? 'bullet' : '',
  ].filter(Boolean);
  const spoken = item.speaker
    ? `<span class="speaker">${escapeHtml(item.speaker)}:</span> ${body}`
    : body;
  const lead = item.bullet ? '• ' : '';
  return `<p${classes.length ? ` class="${classes.join(' ')}"` : ''}>${lead}${spoken}</p>`;
}

function titlePage(book: CompiledBook): string {
  const cover = book.cover ? `<img class="cover" alt="Cover" src="${escapeHtml(book.cover)}">` : '';
  const sub = book.subtitle ? `<p class="subtitle">${escapeHtml(book.subtitle)}</p>` : '';
  const author = book.author ? `<p class="author">${escapeHtml(book.author)}</p>` : '';
  return `<header class="title-page">${cover}<h1>${escapeHtml(book.title)}</h1>${sub}${author}</header>`;
}

export function toHtml(book: CompiledBook, opts: ExportOptions): string {
  const body: string[] = [];
  if (opts.titlePage) body.push(titlePage(book));
  if (opts.toc && book.sections.length > 0) {
    const links = book.sections
      .map((s, i) => `<li><a href="#ch-${i + 1}">${escapeHtml(s.title)}</a></li>`)
      .join('');
    body.push(`<nav class="toc"><h2>Contents</h2><ol>${links}</ol></nav>`);
  }
  book.sections.forEach((section, i) => {
    const showTitle = section.showTitle !== false;
    const brk = opts.pageBreaks && (i > 0 || body.length > 0) ? ' break' : '';
    const items = flattenBlocks(section.blocks, section.styles, opts.gimmickMode);
    const head = showTitle ? `<h2>${escapeHtml(section.title)}</h2>` : '';
    body.push(
      `<section class="chapter${brk}" id="ch-${i + 1}">${head}${items.map((it) => itemToHtml(it, showTitle)).join('\n')}</section>`,
    );
  });
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(book.title)}</title>
<style>${BOOK_CSS}</style>
</head>
<body>
${body.join('\n')}
</body>
</html>
`;
}
