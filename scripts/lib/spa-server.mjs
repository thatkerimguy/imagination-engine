// Static server for the Expo Web export: "single" output is an SPA, so unknown paths fall back to
// index.html. Shared by writer-shots.mjs and writer-shots-tablet.mjs.
import { readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };

export function serveSpa(dist, port) {
  return createServer((req, res) => {
    let file = join(dist, decodeURIComponent((req.url ?? '/').split('?')[0]));
    if (!file.startsWith(dist) || !statSync(file, { throwIfNoEntry: false })?.isFile())
      file = join(dist, 'index.html');
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.end(readFileSync(file));
  }).listen(port, '127.0.0.1');
}
