// Builds the writer's built-in offline Live Preview: apps/reader in `?preview=1` mode compiled
// into ONE self-contained HTML file (all JS, CSS and lazy module chunks inlined) at
// apps/writer/assets/reader-preview.html. Metro ships it as a static asset (never Hermes JS).
//
//   node scripts/build-preview-bundle.mjs              always rebuild
//   node scripts/build-preview-bundle.mjs --if-stale   skip when the output is newer than sources
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const READER = join(ROOT, 'apps/reader');
const OUT = join(ROOT, 'apps/writer/assets/reader-preview.html');
const SOURCES = [
  join(READER, 'src'),
  join(READER, 'offline-preview'),
  join(READER, 'vite.preview.config.ts'),
  join(ROOT, 'packages/core/src'),
  join(ROOT, 'packages/modules'),
];

function newestMtime(path) {
  if (!existsSync(path) || path.includes('node_modules')) return 0;
  const st = statSync(path);
  if (!st.isDirectory()) return st.mtimeMs;
  return readdirSync(path).reduce((m, name) => Math.max(m, newestMtime(join(path, name))), 0);
}

if (process.argv.includes('--if-stale') && existsSync(OUT)) {
  const built = statSync(OUT).mtimeMs;
  if (Math.max(...SOURCES.map(newestMtime)) <= built) {
    console.log(`[preview-bundle] up to date: ${OUT}`);
    process.exit(0);
  }
}

const result = await build({ configFile: join(READER, 'vite.preview.config.ts') });
const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
const htmlAsset = outputs.find((o) => o.type === 'asset' && o.fileName.endsWith('.html'));
const chunks = outputs.filter((o) => o.type === 'chunk');
const css = outputs.filter((o) => o.type === 'asset' && o.fileName.endsWith('.css'));
if (!htmlAsset || chunks.length !== 1) {
  throw new Error(
    `[preview-bundle] expected 1 html + 1 inlined JS chunk, got ${chunks.length} chunk(s): ` +
      chunks.map((c) => c.fileName).join(', '),
  );
}

// `</script` inside inlined JS would close the tag early; `<\/script` is the same string in JS.
const safeJs = chunks[0].code.replaceAll('</script', '<\\/script');
const styles = css.map((c) => String(c.source)).join('\n');
let html = String(htmlAsset.source)
  .replace(/<script\b[^>]*\bsrc="[^"]*"[^>]*><\/script>\s*/g, '')
  .replace(/<link\b[^>]*rel="stylesheet"[^>]*>\s*/g, '')
  .replace(/<link\b[^>]*rel="modulepreload"[^>]*>\s*/g, '');
html = html.replace('</head>', () => `<style>${styles}</style>\n</head>`);
html = html.replace(
  '</body>',
  () =>
    `<script>window.__KN_OFFLINE_PREVIEW__=true</script>\n` +
    `<script type="module">${safeJs}</script>\n</body>`,
);
if (/\s(?:src|href)="(?!data:)[^"#]/.test(html)) {
  throw new Error('[preview-bundle] the HTML still references an external file');
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const bytes = Buffer.byteLength(html);
console.log(
  `[preview-bundle] ${OUT}\n  ${kb(bytes)} raw · ${kb(gzipSync(html).length)} gzipped · ` +
    `modules + three + cannon-es inlined, zero network fetches`,
);
