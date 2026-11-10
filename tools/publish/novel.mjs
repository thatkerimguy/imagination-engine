#!/usr/bin/env node
// `pnpm publish:novel`: a public Player build with novels on its bookshelf (ADR 0022).
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipDirectory } from './zip.mjs';

const HELP = `Usage: pnpm publish:novel <novel.story.json>... [options]

Builds the Player with these novels on its bookshelf. Download a novel from the Studio's
Publish view first (Public), so it has passed the publish check and uses public fallbacks.

Options
  --out <dir>        where the site goes (default: out/site)
  --direct           open the first novel straight away, without the bookshelf
  --zip              also write <out>.zip for itch.io (upload it as an HTML5 game)
  --pages <project>  deploy to a Cloudflare Pages project with wrangler (needs a login)
  --no-build         reuse the last Player build in apps/player/dist
  --help             show this text
`;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) {
  console.log(HELP);
  process.exit(args.length === 0 ? 1 : 0);
}
const take = (flag) => {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  const value = args[i + 1];
  if (!value || value.startsWith('--')) fail(`${flag} needs a value.`);
  args.splice(i, 2);
  return value;
};
const has = (flag) => {
  const i = args.indexOf(flag);
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
};
function fail(message) {
  console.error(message);
  process.exit(1);
}

const out = resolve(root, take('--out') ?? 'out/site');
const pages = take('--pages');
const direct = has('--direct');
const zip = has('--zip');
const build = !has('--no-build');
const unknown = args.find((a) => a.startsWith('--'));
if (unknown) fail(`Unknown option "${unknown}".\n\n${HELP}`);
if (args.length === 0) fail('Name at least one .story.json file.');

// Light checks only: the Player validates every novel fully when it opens it.
const novels = args.map((file) => {
  const path = resolve(file);
  if (!existsSync(path)) fail(`${file} doesn't exist.`);
  let doc;
  try {
    doc = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    fail(`${file} isn't JSON.`);
  }
  if (doc?.format !== 'imagination.story' || typeof doc.id !== 'string')
    fail(`${file} isn't a novel from the Studio.`);
  const private_ = (doc.audio?.tracks ?? []).filter(
    (t) => t.source?.kind === 'spotify' || t.source?.kind === 'youtube',
  );
  if (private_.length)
    fail(
      `${file} still plays Spotify or YouTube (${private_.map((t) => t.title).join(', ')}).\n` +
        'Download it from the Studio as a Public build, which swaps in the public fallbacks.',
    );
  return {
    id: doc.id,
    file: `${doc.id}.story.json`,
    text: JSON.stringify(doc),
    source: basename(file),
  };
});

if (build) {
  console.log('Building the Player...');
  execSync('pnpm --filter @ie/player build', { cwd: root, stdio: 'inherit' });
}
const dist = join(root, 'apps', 'player', 'dist');
if (!existsSync(join(dist, 'index.html'))) fail('No Player build found. Run without --no-build.');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(dist, out, { recursive: true, filter: (src) => !src.endsWith('.map') });
mkdirSync(join(out, 'novels'), { recursive: true });
for (const n of novels) writeFileSync(join(out, 'novels', n.file), n.text);
writeFileSync(
  join(out, 'novels', 'index.json'),
  JSON.stringify(
    { novels: novels.map(({ id, file }) => ({ id, file })), ...(direct ? { direct } : {}) },
    null,
    2,
  ),
);
console.log(`Site: ${out} (${novels.map((n) => n.source).join(', ')})`);

if (zip) {
  const file = `${out}.zip`;
  writeFileSync(file, zipDirectory(out));
  console.log(`itch.io zip: ${file}`);
}
if (pages) {
  // The name goes into a shell command: Cloudflare's own rule for project names, nothing else.
  if (!/^[a-z0-9][a-z0-9-]{0,57}$/.test(pages)) {
    console.error('A Pages project name uses lowercase letters, digits and dashes.');
    process.exit(1);
  }
  console.log(`Deploying to Cloudflare Pages project "${pages}"...`);
  execSync(`npx wrangler pages deploy "${out}" --project-name "${pages}"`, {
    cwd: root,
    stdio: 'inherit',
  });
}
