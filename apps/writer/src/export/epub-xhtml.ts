// EPUB 3 content documents (XHTML): chapters, cover page, title page and the nav document. Pure.
import type { Block } from '@kn/core';
import type { InlineRun } from '../editor/inline-markup.ts';
import type { CompiledBook, BookSection, ExportOptions } from './book-model.ts';
import { flattenBlocks, headingDepth, type Item } from './flatten.ts';
import { renderCue } from './gimmick-text.ts';
import { italicRuns, markupRuns } from './markup-util.ts';

// eslint-disable-next-line no-control-regex
const ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

/** Escapes text for XML content and attribute values; drops XML-illegal control characters. */
export function escapeXml(s: string): string {
  return s
    .replace(ILLEGAL, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const chapterFile = (i: number): string => `ch-${String(i + 1).padStart(3, '0')}.xhtml`;
export const sectionTitle = (s: BookSection, i: number): string =>
  s.title.trim() || `Chapter ${i + 1}`;

function wrapRun(r: InlineRun): string {
  let s = escapeXml(r.text).replace(/\n/g, '<br/>');
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

function itemXhtml(item: Item, showTitle: boolean): string {
  if (item.type === 'break') {
    const label = item.label ? `<p class="scene-label">${escapeXml(item.label)}</p>` : '';
    return `<hr class="scene-break"/>${label}`;
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
    ? `<span class="speaker">${escapeXml(item.speaker)}:</span> ${body}`
    : body;
  const lead = item.bullet ? '• ' : '';
  return `<p${classes.length ? ` class="${classes.join(' ')}"` : ''}>${lead}${spoken}</p>`;
}

/** HTML void tags written as XML (`<br>` → `<br/>`), so template output stays well-formed. */
export const xmlVoid = (html: string): string =>
  html.replace(
    /<(br|hr|img|wbr)(\s[^<>]*?)?\s*\/?>/gi,
    (_m, tag: string, attrs = '') => `<${tag}${attrs}/>`,
  );

function blockXhtml(b: Block, s: BookSection, opts: ExportOptions, showTitle: boolean): string {
  if (b.kind === 'module' && opts.gimmickMode === 'transcript') {
    const r = renderCue(b, 'epubXhtml', s.blueprints);
    if (r?.text) return xmlVoid(r.text);
  }
  return flattenBlocks([b], s.styles, opts.gimmickMode, s.blueprints)
    .map((it) => itemXhtml(it, showTitle))
    .join('\n');
}

/** A complete XHTML5 content document. `body` is already-escaped markup. */
export function page(lang: string, title: string, body: string, bodyAttrs = ''): string {
  const l = escapeXml(lang);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${l}" xml:lang="${l}">
<head>
<meta charset="utf-8"/>
<title>${escapeXml(title)}</title>
<link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body${bodyAttrs}>
${body}
</body>
</html>
`;
}

export function chapterXhtml(
  section: BookSection,
  index: number,
  opts: ExportOptions,
  lang: string,
): string {
  const showTitle = section.showTitle !== false;
  const title = sectionTitle(section, index);
  const head = showTitle ? `<h1>${escapeXml(title)}</h1>\n` : '';
  const body = section.blocks
    .map((b) => blockXhtml(b, section, opts, showTitle))
    .filter(Boolean)
    .join('\n');
  return page(
    lang,
    title,
    `<section epub:type="chapter" id="chapter">\n${head}${body}\n</section>`,
  );
}

export function titlePageXhtml(book: CompiledBook, lang: string): string {
  const sub = book.subtitle ? `<p class="subtitle">${escapeXml(book.subtitle)}</p>` : '';
  const author = book.author ? `<p class="author">${escapeXml(book.author)}</p>` : '';
  const title = book.title.trim() || 'Untitled';
  return page(
    lang,
    title,
    `<section epub:type="titlepage" class="title-page">\n<h1>${escapeXml(title)}</h1>\n${sub}${author}\n</section>`,
  );
}

export function coverXhtml(title: string, imageFile: string, lang: string): string {
  return page(
    lang,
    title,
    `<section epub:type="cover" class="cover">\n<img src="${escapeXml(imageFile)}" alt="Cover"/>\n</section>`,
  );
}

export interface NavEntry {
  href: string;
  title: string;
}

export function navXhtml(title: string, entries: readonly NavEntry[], lang: string): string {
  const items = entries
    .map((e) => `<li><a href="${escapeXml(e.href)}">${escapeXml(e.title)}</a></li>`)
    .join('\n');
  return page(
    lang,
    title,
    `<nav epub:type="toc" id="toc">\n<h1>Contents</h1>\n<ol>\n${items}\n</ol>\n</nav>`,
  );
}
