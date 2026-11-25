// Zero-dependency local harness: node:http + in-memory store. Run with `pnpm dev:local`.
// Uses only erasable TS syntax so Node can run it directly.
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { createMemoryStore } from './store.ts';
import { handleRequest } from './worker.ts';

const store = createMemoryStore();

async function toRequest(req: IncomingMessage, origin: string): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const method = req.method ?? 'GET';
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const init: RequestInit = { method, headers };
  if (hasBody) init.body = Buffer.concat(chunks);
  return new Request(new URL(req.url ?? '/', origin), init);
}

export interface LocalServer {
  url: string;
  close(): Promise<void>;
}

export function startLocalServer(opts: { port: number; token: string }): Promise<LocalServer> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const origin = `http://127.0.0.1:${opts.port}`;
      toRequest(req, origin)
        .then((request) => handleRequest(request, { store, token: opts.token }))
        .then(async (response) => {
          const headers: Record<string, string> = {};
          response.headers.forEach((v, k) => (headers[k] = v));
          res.writeHead(response.status, headers);
          res.end(Buffer.from(await response.arrayBuffer()));
        })
        .catch(() => {
          res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
          res.end('{"ok":false,"error":"Internal error"}');
        });
    });
    server.once('error', reject);
    server.listen(opts.port, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  const port = Number(process.env.PORT ?? '8787');
  const token = process.env.PUBLISH_TOKEN ?? '';
  if (!token) console.warn('PUBLISH_TOKEN is not set: authed routes will answer 503.');
  const server = await startLocalServer({ port, token });
  console.log(`publish-api listening on ${server.url}`);
}
