// HTML helpers: escaping, the strict-CSP response wrapper, and the shared page shell.

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text for both element content and quoted attribute values. */
export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

export const CSP =
  "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

export function htmlResponse(html: string, status = 200, cache = 'public, max-age=3600'): Response {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': cache,
    },
  });
}

const STYLE = `
:root{color-scheme:light dark;--bg:#fafaf7;--fg:#1d1d1b;--mut:#5d5d58;--acc:#b3452f;--line:#d9d8d2}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--fg:#ecebe6;--mut:#a3a29b;--acc:#e0795f;--line:#34332f}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.6 Georgia,serif}
main{max-width:40rem;margin:0 auto;padding:1.25rem}
h1{font-size:1.6rem;line-height:1.25}h2{font-size:1.15rem;margin-top:1.8rem}
a{color:var(--acc)}nav{display:flex;flex-wrap:wrap;gap:1rem;padding:.75rem 0;border-bottom:1px solid var(--line)}
label{display:block;margin:1rem 0 .25rem;font-weight:bold}
input,select,textarea{width:100%;padding:.6rem;font:inherit;color:inherit;background:transparent;border:1px solid var(--line);border-radius:6px}
button{margin-top:1.2rem;padding:.7rem 1.4rem;font:inherit;border:0;border-radius:6px;background:var(--acc);color:#fff}
small,.muted{color:var(--mut)}`;

export interface ShellOptions {
  title: string;
  body: string;
  /** Extra, already-escaped `<head>` markup (meta tags). */
  head?: string;
}

export function pageShell({ title, body, head = '' }: ShellOptions): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>${head}
<style>${STYLE}</style></head>
<body><main>${body}</main></body></html>`;
}
