// Royal Road HTML: a paste-ready fragment (no <html>/<head>/<style>/<script>, no classes) using
// only tags and inline styles the site's editor keeps. Cues use their blueprint's royalRoadHtml.
// Pure.
import type { ModuleBlock } from '@kn/core';
import type { InlineRun } from '../editor/inline-markup.ts';
import type { CompiledBook, ExportOptions } from './book-model.ts';
import { flattenBlocks, headingDepth, type Item } from './flatten.ts';
import { gimmickLines, renderCue, type InlineBlueprints } from './gimmick-text.ts';
import { escapeHtml } from './html.ts';
import { markupRuns } from './markup-util.ts';

function wrapRun(r: InlineRun): string {
  let s = escapeHtml(r.text).replace(/\n/g, '<br>');
  if (r.underline) s = `<u>${s}</u>`;
  if (r.strike) s = `<s>${s}</s>`;
  if (r.italic) s = `<em>${s}</em>`;
  if (r.bold) s = `<strong>${s}</strong>`;
  return s;
}

const inline = (text: string): string => markupRuns(text).map(wrapRun).join('');

function itemHtml(item: Item, showTitle: boolean): string {
  if (item.type === 'break') {
    const label = item.label ? `<p><em>${escapeHtml(item.label)}</em></p>` : '';
    return `<hr>${label}`;
  }
  let body = inline(item.text);
  if (item.italic) body = `<em>${body}</em>`;
  if (item.heading) {
    const n = Math.min(6, headingDepth(item.heading, showTitle) + 1);
    return `<h${n}>${body}</h${n}>`;
  }
  if (item.speaker) body = `<strong>${escapeHtml(item.speaker)}:</strong> ${body}`;
  if (item.bullet) body = `• ${body}`;
  const style = item.align && item.align !== 'left' ? ` style="text-align:${item.align};"` : '';
  const p = `<p${style}>${body}</p>`;
  return item.quote ? `<blockquote>${p}</blockquote>` : p;
}

/** A cue as Royal Road HTML: its blueprint's own `royalRoadHtml` template (escaped values). */
function cueHtml(b: ModuleBlock, opts: ExportOptions, inline: InlineBlueprints): string[] {
  if (opts.gimmickMode === 'omit') return [];
  if (opts.gimmickMode === 'transcript') {
    const r = renderCue(b, 'royalRoadHtml', inline);
    if (r?.text) return [r.text];
  }
  return gimmickLines(b, opts.gimmickMode, inline).map((l) =>
    l.speaker
      ? `<p><strong>${escapeHtml(l.speaker)}:</strong> ${escapeHtml(l.text)}</p>`
      : `<p><em>${escapeHtml(l.text)}</em></p>`,
  );
}

export function buildRoyalRoadHtml(book: CompiledBook, opts: ExportOptions): string {
  const out: string[] = [];
  if (opts.titlePage) {
    out.push(`<h1>${escapeHtml(book.title)}</h1>`);
    if (book.subtitle) out.push(`<p><em>${escapeHtml(book.subtitle)}</em></p>`);
    if (book.author) out.push(`<p>${escapeHtml(book.author)}</p>`);
  }
  for (const section of book.sections) {
    const showTitle = section.showTitle !== false;
    if (showTitle) out.push(`<h2>${escapeHtml(section.title)}</h2>`);
    for (const b of section.blocks) {
      if (b.kind === 'module') out.push(...cueHtml(b, opts, section.blueprints));
      else
        for (const item of flattenBlocks([b], section.styles, opts.gimmickMode, section.blueprints))
          out.push(itemHtml(item, showTitle));
    }
  }
  return `${out.join('\n')}\n`;
}
