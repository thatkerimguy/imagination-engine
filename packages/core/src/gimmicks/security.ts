// Blueprint security scan. Blueprints are shareable data, so every string is checked for script
// injection and remote fetches, and HTML export templates may only use a small tag allowlist.

const FORBIDDEN: readonly [RegExp, string][] = [
  [/<\s*\/?\s*script/i, 'contains a <script> tag'],
  [/javascript\s*:/i, 'contains a javascript: URL'],
  [/vbscript\s*:/i, 'contains a vbscript: URL'],
  [/(^|[\s"'/<])on[a-z]+\s*=/i, 'contains an inline event handler'],
  [/https?:\/\//i, 'contains an external URL'],
  [/\/\/[a-z0-9-]+\.[a-z]{2,}/i, 'contains an external URL'],
  [/<\s*(iframe|object|embed|link|meta|base|form|style|svg|math|img)\b/i, 'contains a blocked tag'],
  [/url\s*\(|expression\s*\(|@import/i, 'contains a CSS fetch'],
];

const ALLOWED_TAGS = new Set(
  (
    'p div span strong em b i u s br hr blockquote ul ol li h1 h2 h3 h4 h5 h6 table thead ' +
    'tbody tr td th small sup sub code pre figure figcaption section aside header footer'
  ).split(' '),
);
const ALLOWED_ATTR = /^(class|style|role|lang|dir|colspan|rowspan|epub:type|aria-[a-z]+)$/;

/** Inline-style properties export HTML may use: visual only, nothing that can fetch or run. */
const STYLE_PROP =
  /^(border(-[a-z]+)*|background(-color)?|color|padding(-[a-z]+)?|margin(-[a-z]+)?|width|max-width|font(-[a-z]+)?|text-align|text-transform|letter-spacing|line-height)$/;
const STYLE_VALUE_BAD = /url\s*\(|expression\s*\(|javascript\s*:|@import|[<>\\]/i;

/** Declarations in one `style` value outside the allowlist (or carrying a fetch / script). */
export function styleIssues(style: string): string[] {
  const issues: string[] = [];
  for (const decl of style.split(';')) {
    if (!decl.trim()) continue;
    const at = decl.indexOf(':');
    const prop = (at < 0 ? decl : decl.slice(0, at)).trim().toLowerCase();
    if (at < 0 || !STYLE_PROP.test(prop)) issues.push(`style property ${prop} is not allowed`);
    else if (STYLE_VALUE_BAD.test(decl.slice(at + 1))) issues.push(`style ${prop} value is unsafe`);
  }
  return issues;
}

/** Rendered export HTML: keeps only allowlisted, safe declarations inside every `style="…"`. */
export function sanitizeStyles(html: string): string {
  return html.replace(/\sstyle\s*=\s*"([^"]*)"/gi, (_m, css: string) => {
    const kept = css
      .split(';')
      .filter((d) => d.trim() && styleIssues(d).length === 0)
      .map((d) => d.trim());
    return kept.length ? ` style="${kept.join(';')}"` : '';
  });
}

function walk(value: unknown, path: string, out: [string, string][]): void {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}.${i}`, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k, out);
  }
}

/** Tags and attributes outside the allowlist in an HTML export template. */
export function templateTagIssues(html: string): string[] {
  const issues: string[] = [];
  for (const m of html.matchAll(/<\/?\s*([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>/g)) {
    const tag = m[1]!.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) issues.push(`tag <${tag}> is not allowed`);
    for (const a of (m[2] ?? '').matchAll(/([a-zA-Z:-]+)\s*=/g)) {
      if (!ALLOWED_ATTR.test(a[1]!.toLowerCase())) issues.push(`attribute ${a[1]} is not allowed`);
    }
    for (const st of (m[2] ?? '').matchAll(/style\s*=\s*"([^"]*)"/gi)) {
      // Interpolated values are sanitized at render time; only the template's own CSS is checked.
      issues.push(...styleIssues(st[1]!.replace(/\{\{[^}]*\}\}/g, 'x')));
    }
  }
  return issues;
}

/** Every security problem in a parsed blueprint, as `path: reason` strings. */
export function securityIssues(blueprint: object): string[] {
  const strings: [string, string][] = [];
  walk(blueprint, '', strings);
  const issues = strings.flatMap(([path, s]) =>
    FORBIDDEN.filter(([re]) => re.test(s)).map(([, why]) => `${path}: ${why}`),
  );
  const exp = (blueprint as { exports?: Record<string, unknown> }).exports ?? {};
  for (const fmt of ['epubXhtml', 'royalRoadHtml'] as const) {
    const html = exp[fmt];
    if (typeof html === 'string') {
      issues.push(...templateTagIssues(html).map((i) => `exports.${fmt}: ${i}`));
    }
  }
  return [...new Set(issues)];
}
