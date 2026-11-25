// PostToolUse (Edit|Write) formatter: runs Prettier in-process on the one file just touched.
// Silent no-op when the path is missing, deleted, outside the workspace, an unhandled extension,
// or listed in .prettierignore. Never fails the tool call (always exits 0); hard 5 s ceiling.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, isAbsolute, relative, resolve } from 'node:path';

const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md']);
const root = resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
setTimeout(() => process.exit(0), 5000).unref();

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => void run().finally(() => process.exit(0)));

async function run() {
  let file;
  try {
    file = String(JSON.parse(raw)?.tool_input?.file_path ?? '');
  } catch {
    return;
  }
  if (!file) return;
  const abs = resolve(root, file);
  const rel = relative(root, abs);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return;
  if (rel.split(/[\\/]/).includes('node_modules')) return;
  if (!EXTS.has(extname(abs).toLowerCase()) || !existsSync(abs)) return;
  try {
    const prettier = createRequire(resolve(root, 'package.json'))('prettier');
    const info = await prettier.getFileInfo(abs, { ignorePath: resolve(root, '.prettierignore') });
    if (info.ignored || !info.inferredParser) return;
    const options = { ...(await prettier.resolveConfig(abs)), filepath: abs };
    const source = readFileSync(abs, 'utf8');
    const out = await prettier.format(source, options);
    if (out !== source) writeFileSync(abs, out);
  } catch (e) {
    process.stderr.write(`format hook skipped ${rel}: ${e instanceof Error ? e.message : e}\n`);
  }
}
