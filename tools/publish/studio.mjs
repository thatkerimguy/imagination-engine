#!/usr/bin/env node
// `pnpm publish:studio`: the private Studio on Cloudflare Pages, behind Cloudflare Access (ADR 0022).
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HELP = `Usage: pnpm publish:studio [options]

Builds the Studio into out/studio (site in public/, the audio relay in functions/).

Options
  --pages <project>  deploy to this Cloudflare Pages project with wrangler (needs a login)
  --no-build         reuse the last Studio build in apps/studio/dist
  --help             show this text

Before the first deploy, protect the project with Cloudflare Access (Zero Trust → Access →
Applications → Self-hosted, the project's pages.dev domain, a policy allowing only your e-mail).
Without Access the Studio would be public.
`;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(HELP);
  process.exit(0);
}
const pagesAt = args.indexOf('--pages');
const pages = pagesAt >= 0 ? args[pagesAt + 1] : undefined;
if (pagesAt >= 0 && (!pages || pages.startsWith('--'))) {
  console.error('--pages needs a project name.');
  process.exit(1);
}
const build = !args.includes('--no-build');

if (build) {
  console.log('Building the Studio...');
  execSync('pnpm --filter @ie/studio build', { cwd: root, stdio: 'inherit' });
}
const dist = join(root, 'apps', 'studio', 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('No Studio build found. Run without --no-build.');
  process.exit(1);
}
const out = join(root, 'out', 'studio');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'functions'), { recursive: true });
cpSync(dist, join(out, 'public'), { recursive: true, filter: (src) => !src.endsWith('.map') });
cpSync(
  join(root, 'tools', 'publish', 'studio-functions', 'fetch.js'),
  join(out, 'functions', 'fetch.js'),
);
// Never let a search engine list the private Studio, even if Access is misconfigured.
writeFileSync(
  join(out, 'public', '_headers'),
  '/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n',
);
console.log(`Studio: ${out}`);

if (pages) {
  // The name goes into a shell command: Cloudflare's own rule for project names, nothing else.
  if (!/^[a-z0-9][a-z0-9-]{0,57}$/.test(pages)) {
    console.error('A Pages project name uses lowercase letters, digits and dashes.');
    process.exit(1);
  }
  console.log(`Deploying to Cloudflare Pages project "${pages}"...`);
  execSync(`npx wrangler pages deploy public --project-name "${pages}"`, {
    cwd: out,
    stdio: 'inherit',
  });
}
