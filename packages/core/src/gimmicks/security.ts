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
