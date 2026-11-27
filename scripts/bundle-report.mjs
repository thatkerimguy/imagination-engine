// Acceptance gate: the reader's initial JS must stay <= 20 KB gzipped (target 18 KB, OVERHAUL-03),
// three.js / cannon-es only in lazy chunks, every v2 engine chunk <= 6 KB, and zod in NO chunk.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../apps/reader/dist/', import.meta.url));
const BUDGET = 20 * 1024;
const TARGET = 18 * 1024;
const ENGINE_BUDGET = 6 * 1024;
const ENGINES =
  /^(frame-hud|chat-thread|text-alchemy|artifact-doc|tactile-reveal|telemetry-meter|kinetic-prose)-/;
const MODULE_BUDGET = 300 * 1024;
const gz = (file) => gzipSync(readFileSync(join(DIST, file))).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const initial = [...html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
let total = 0;
let failed = false;
console.log('\nInitial reader JS (gzipped):');
for (const file of initial) {
  const size = gz(file);
  total += size;
  const src = readFileSync(join(DIST, file), 'utf8');
  const heavy = /WebGLRenderer|cannon-es|ContactMaterial/.test(src);
  console.log(`  ${file}  ${kb(size)}${heavy ? '  ❌ contains three/cannon' : ''}`);
  if (heavy) failed = true;
}
console.log(
  `  total ${kb(total)} / target ${kb(TARGET)} / hard cap ${kb(BUDGET)} ${total <= TARGET ? '✅' : '❌'}`,
);
if (total > TARGET) failed = true;

console.log('\nLazy chunks (gzipped):');
const lazy = readdirSync(join(DIST, 'assets/lazy')).filter((f) => f.endsWith('.js'));
for (const f of lazy.sort()) {
  const size = gz(`assets/lazy/${f}`);
  const shared = /^(three|stage-gl)/.test(f);
  const engine = ENGINES.test(f);
  const flag =
    engine && size > ENGINE_BUDGET
      ? '  ❌ over 6 KB engine budget'
      : !shared && size > MODULE_BUDGET
        ? '  ❌ over module budget'
        : '';
  if (flag) failed = true;
  console.log(`  ${f}  ${kb(size)}${engine ? '  (v2 engine)' : ''}${flag}`);
}

// The reader must never ship Zod (it validates with @kn/core/guard): check every sourcemap.
const maps = (dir) =>
  readdirSync(join(DIST, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? maps(join(dir, e.name))
      : e.name.endsWith('.js.map')
        ? [join(dir, e.name)]
        : [],
  );
const zod = maps('assets').filter((m) =>
  JSON.parse(readFileSync(join(DIST, m), 'utf8')).sources.some((src) => /[\\/]zod[\\/@]/.test(src)),
);
console.log(`
Zod in reader chunks: ${zod.length ? '❌ ' + zod.join(', ') : 'none ✅'}`);
if (zod.length) failed = true;
if (failed) {
  console.error('\nBundle budget failed.');
  process.exit(1);
}
console.log('\nBundle budget OK.\n');
