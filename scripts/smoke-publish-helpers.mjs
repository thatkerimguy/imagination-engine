// Process + static-server helpers for smoke-publish.mjs.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
export const win = process.platform === 'win32';
const children = [];
export const stopAll = () => {
  for (const c of children) {
    if (win) spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F']);
    else
      try {
        process.kill(-c.pid, 'SIGTERM');
      } catch {
        c.kill();
      }
  }
  children.length = 0;
};
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => (stopAll(), process.exit(130)));

export const freePort = (preferred) =>
  new Promise((res) => {
    const s = createNetServer();
    s.once('error', () => (s.close(), freePort(0).then(res)));
    s.listen(preferred, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });

function spawnLogged(cmd, args, env) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: win,
    detached: !win,
  });
  children.push(child);
  return child;
}

export async function startApi(port, token, env = {}) {
  const child = spawnLogged('node', ['apps/publish-api/src/local-server.ts'], {
    PORT: String(port),
    PUBLISH_TOKEN: token,
    ...env,
  });
  await new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('publish API did not start')), 15000);
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('exit', (code) => rej(new Error(`publish API exited (${code})`)));
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d;
      if (buf.includes(`publish-api listening on http://127.0.0.1:${port}`)) {
        clearTimeout(timer);
        res();
      }
    });
  });
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};
export function serveStatic(dir, port) {
  return new Promise((res) => {
    const server = createServer((req, r) => {
      let file = join(dir, decodeURIComponent((req.url ?? '/').split('?')[0]));
      if (!file.startsWith(dir) || !statSync(file, { throwIfNoEntry: false })?.isFile())
        file = join(dir, 'index.html');
      r.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
      r.end(readFileSync(file));
    }).listen(port, '127.0.0.1', () => res(server));
  });
}
