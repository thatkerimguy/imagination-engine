// Universal safe export renderer. Zero dependencies, never `eval` / `new Function`.
//   {{key}}                         a prop (lists join with ", ")
//   {{#each list}}{{.}}{{/each}}    string lists; {{@n}} is the 1-based item number
//   {{#each msgs}}{{sender}}{{/each}} object lists: {{field}} reads the item, then the props
// HTML formats escape every interpolated value and strip any <script>/<style> in the template.
import type { BlueprintExports, BlueprintProps, ExportFormat } from './types.ts';

const HTML_FORMATS: ReadonlySet<ExportFormat> = new Set(['epubXhtml', 'royalRoadHtml']);

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

type Scope = Readonly<Record<string, unknown>>;

function scalar(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.map(scalar).join(', ');
  if (typeof v === 'object') return '';
  return String(v);
}

function stripForbidden(tpl: string): string {
  return tpl
    .replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|style)\b[^>]*>/gi, '');
}

const collapse = (s: string): string =>
  s
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Renders one template string against props (exported for tests and the writer exporters). */
export function renderTemplate(
  tpl: string,
  props: Readonly<BlueprintProps>,
  html: boolean,
): string {
  const esc = html ? escapeHtml : (s: string): string => s;
  const source = html ? stripForbidden(tpl) : tpl;
  const fill = (body: string, scope: Scope, item?: unknown, n?: number): string =>
    body.replace(/\{\{\s*(\.|@n|[a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g, (_m, tok: string) => {
      if (tok === '@n') return n === undefined ? '' : String(n);
      if (tok === '.') return esc(scalar(item));
      const own =
        item && typeof item === 'object' && !Array.isArray(item) ? (item as Scope)[tok] : undefined;
      return esc(scalar(own !== undefined ? own : scope[tok]));
    });
  const looped = source.replace(
    /\{\{#each\s+([a-zA-Z][a-zA-Z0-9]*)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_m, key: string, body: string) => {
      const v = props[key];
      const items: unknown[] = Array.isArray(v) ? v : v === undefined || v === '' ? [] : [v];
      return items.map((item, i) => fill(body, props, item, i + 1)).join('');
    },
  );
  const out = fill(looped, props);
  return html ? out.trim() : collapse(out);
}

export function renderBlueprintExport(
  blueprint: { exports: BlueprintExports; defaultProps: BlueprintProps },
  props: Readonly<BlueprintProps>,
  format: ExportFormat,
): string {
  const merged = { ...blueprint.defaultProps, ...props };
  return renderTemplate(blueprint.exports[format], merged, HTML_FORMATS.has(format));
}
