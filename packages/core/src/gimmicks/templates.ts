// Universal safe export renderer. Zero dependencies, never `eval` / `new Function`.
//   {{key}}                         a prop (lists join with ", ")
//   {{#each list}}{{.}}{{/each}}    string lists; {{@n}} is the 1-based item number
//   {{#each msgs}}{{sender}}{{/each}} object lists: {{field}} reads the item, then the props
//   {{#if key}}…{{else}}…{{/if}}       optional sections (nest inside / around {{#each}})
// HTML formats escape every interpolated value, strip any <script>/<style> in the template and
// drop any inline-style declaration outside the safe visual allowlist (security.ts).
import { sanitizeStyles } from './security.ts';
import { isTruthy, parseTemplate, type TemplateNode } from './template-ast.ts';
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

interface Frame {
  scope: Scope;
  item?: unknown;
  n?: number;
}

function lookup(key: string, f: Frame): unknown {
  if (key === '.') return f.item;
  if (key === '@n') return f.n;
  const own =
    f.item && typeof f.item === 'object' && !Array.isArray(f.item)
      ? (f.item as Scope)[key]
      : undefined;
  return own !== undefined ? own : f.scope[key];
}

function emit(nodes: readonly TemplateNode[], f: Frame, esc: (s: string) => string): string {
  let out = '';
  for (const node of nodes) {
    if (node.kind === 'text') out += node.text;
    else if (node.kind === 'value') {
      out +=
        node.key === '@n'
          ? f.n === undefined
            ? ''
            : String(f.n)
          : esc(scalar(lookup(node.key, f)));
    } else if (node.kind === 'if') {
      out += emit(isTruthy(lookup(node.key, f)) ? node.then : node.else, f, esc);
    } else {
      const v = lookup(node.key, f);
      const items: unknown[] = Array.isArray(v) ? v : v === undefined || v === '' ? [] : [v];
      items.forEach((item, i) => (out += emit(node.body, { scope: f.scope, item, n: i + 1 }, esc)));
    }
  }
  return out;
}

/** Renders one template string against props (exported for tests and the writer exporters). */
export function renderTemplate(
  tpl: string,
  props: Readonly<BlueprintProps>,
  html: boolean,
): string {
  const esc = html ? escapeHtml : (s: string): string => s;
  const source = html ? stripForbidden(tpl) : tpl;
  const out = emit(parseTemplate(source), { scope: props }, esc);
  return html ? sanitizeStyles(out).trim() : collapse(out);
}

export function renderBlueprintExport(
  blueprint: { exports: BlueprintExports; defaultProps: BlueprintProps },
  props: Readonly<BlueprintProps>,
  format: ExportFormat,
): string {
  const merged = { ...blueprint.defaultProps, ...props };
  return renderTemplate(blueprint.exports[format], merged, HTML_FORMATS.has(format));
}
