// Acceptance gate (DIRECTIVE 01 §4.2): the reader's initial JS must stay under 40 KB gzipped,
// and three.js / cannon-es must only ever appear in lazy chunks.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const DIST = new URL('../apps/reader/dist/', import.meta.url).pathname;
const BUDGET = 40 * 1024;
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
console.log(`  total ${kb(total)} / budget ${kb(BUDGET)} ${total < BUDGET ? '✅' : '❌'}`);
if (total >= BUDGET) failed = true;

console.log('\nLazy chunks (gzipped):');
const lazy = readdirSync(join(DIST, 'assets/lazy')).filter((f) => f.endsWith('.js'));
for (const f of lazy.sort()) {
  const size = gz(`assets/lazy/${f}`);
  const shared = /^(three|stage-gl)/.test(f);
  const flag = !shared && size > MODULE_BUDGET ? '  ❌ over module budget' : '';
  if (flag) failed = true;
  console.log(`  ${f}  ${kb(size)}${flag}`);
}
if (failed) {
  console.error('\nBundle budget failed.');
  process.exit(1);
}
console.log('\nBundle budget OK.\n');
