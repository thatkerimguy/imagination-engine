// Royal Road HTML: a paste-ready fragment (no <html>/<head>/<style>/<script>, no classes) using
// only tags and inline styles the site's editor keeps. LitRPG System Boxes become styled tables.
// Pure.
import type { InlineRun } from '../editor/inline-markup.ts';
import type { CompiledBook, ExportOptions } from './book-model.ts';
import { flattenBlocks, headingDepth, type Item } from './flatten.ts';
import { gimmickLines } from './gimmick-text.ts';
import { escapeHtml } from './html.ts';
import { markupRuns } from './markup-util.ts';

const SYSTEM_BOX_ID = 'litrpg-system-box';

const ACCENT: Readonly<Record<string, string>> = {
  skill: '#3b82f6',
  warning: '#dc2626',
  'level-up': '#f59e0b',
  quest: '#10b981',
};
const DEFAULT_ACCENT = ACCENT.skill!;

function wrapRun(r: InlineRun): string {
  let s = escapeHtml(r.text).replace(/\n/g, '<br>');
  if (r.underline) s = `<u>${s}</u>`;
  if (r.strike) s = `<s>${s}</s>`;
  if (r.italic) s = `<em>${s}</em>`;
  if (r.bold) s = `<strong>${s}</strong>`;
  return s;
}

const inline = (text: string): string => markupRuns(text).map(wrapRun).join('');

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function systemTable(props: Record<string, unknown>): string {
  const accent = ACCENT[str(props.variant)] ?? DEFAULT_ACCENT;
  const head = [str(props.header), str(props.title)]
    .filter((s) => s.trim() !== '')
    .map(escapeHtml)
    .join('<br>');
  const lines = Array.isArray(props.lines) ? props.lines.filter((l) => typeof l === 'string') : [];
  const th = `<tr><th style="color:${accent};text-align:center;letter-spacing:0.12em;padding:8px 12px;border-bottom:1px solid ${accent};">${head}</th></tr>`;
  const rows = lines.map((l) => `<tr><td style="padding:4px 12px;">${escapeHtml(l)}</td></tr>`);
  return `<table style="border-collapse:collapse;width:100%;background:#0c2340;color:#eef6ff;border:2px solid ${accent};margin:1em 0;">${th}${rows.join('')}</table>`;
}

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

function cueHtml(b: Parameters<typeof gimmickLines>[0], opts: ExportOptions): string[] {
  if (opts.gimmickMode === 'omit') return [];
  if (b.moduleId === SYSTEM_BOX_ID) return [systemTable(b.props)];
  return gimmickLines(b, opts.gimmickMode).map((l) =>
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
      if (b.kind === 'module') out.push(...cueHtml(b, opts));
      else
        for (const item of flattenBlocks([b], section.styles, opts.gimmickMode))
          out.push(itemHtml(item, showTitle));
    }
  }
  return `${out.join('\n')}\n`;
}
