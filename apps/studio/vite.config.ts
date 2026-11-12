import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Hosts whose audio the relay may fetch: the catalogues' own file servers (ADR 0012). */
const RELAY_HOSTS = [
  /^api\.audius\.co$/,
  /(^|\.)jamendo\.com$/,
  /(^|\.)freesound\.org$/,
  /^upload\.wikimedia\.org$/,
  /(^|\.)ccmixter\.org$/,
  /(^|\.)openverse\.org$/,
];
const RELAY_MAX_BYTES = 60 * 1024 * 1024;

/**
 * `/fetch?url=…`: fetches catalogue audio for beat analysis when the host sends no CORS headers.
 * Local servers only (dev and preview, both on 127.0.0.1), GET only, allowlisted hosts only.
 */
function audioRelay(): Plugin {
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const target = new URL(req.url ?? '', 'http://relay').searchParams.get('url') ?? '';
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      res.statusCode = 400;
      return res.end('Bad url');
    }
    if (
      req.method !== 'GET' ||
      url.protocol !== 'https:' ||
      !RELAY_HOSTS.some((h) => h.test(url.hostname))
    ) {
      res.statusCode = 403;
      return res.end('Not allowed');
    }
    try {
      const upstream = await fetch(url, { redirect: 'follow' });
      const length = Number(upstream.headers.get('content-length') ?? 0);
      if (!upstream.ok || length > RELAY_MAX_BYTES) {
        res.statusCode = upstream.ok ? 413 : upstream.status;
        return res.end();
      }
      const body = Buffer.from(await upstream.arrayBuffer());
      if (body.byteLength > RELAY_MAX_BYTES) {
        res.statusCode = 413;
        return res.end();
      }
      res.setHeader(
        'Content-Type',
        upstream.headers.get('content-type') ?? 'application/octet-stream',
      );
      res.end(body);
    } catch {
      res.statusCode = 502;
      res.end();
    }
  };
  const use = (server: {
    middlewares: {
      use(path: string, fn: (req: IncomingMessage, res: ServerResponse) => void): void;
    };
  }) => {
    // A block body on purpose: a returned function would be taken as a post-middleware hook.
    server.middlewares.use('/fetch', (req, res) => void handle(req, res));
  };
  return { name: 'ie-audio-relay', configureServer: use, configurePreviewServer: use };
}

/**
 * `/sync/…`: the device-sync store for dev and preview (ADR 0024), files in `.sync/` (or
 * IE_SYNC_DIR). Same protocol as the hosted store (tools/publish/studio-functions/sync.js), so the
 * Studio syncs between two browsers on this machine, which is what the e2e test does.
 */
function syncStore(): Plugin {
  const dir = resolve(
    process.env.IE_SYNC_DIR ?? join(fileURLToPath(new URL('.', import.meta.url)), '.sync'),
  );
  const ID = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
  const etagOf = (text: string) => `"${createHash('sha1').update(text).digest('hex')}"`;
  const send = (
    res: ServerResponse,
    status: number,
    body?: string,
    headers: Record<string, string> = {},
  ) => {
    res.statusCode = status;
    res.setHeader('Cache-Control', 'no-store');
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end(body);
  };
  const readBody = (req: IncomingMessage) =>
    new Promise<string>((done, fail) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (c: Buffer) => {
        size += c.byteLength;
        if (size > 25 * 1024 * 1024) req.destroy(new Error('too big'));
        else chunks.push(c);
      });
      req.on('end', () => done(Buffer.concat(chunks).toString('utf8')));
      req.on('error', fail);
    });
  const FILE = /^[A-Za-z][A-Za-z0-9_]{0,63}\.[a-z0-9]{1,5}$/;
  const readBytes = (req: IncomingMessage) =>
    new Promise<Buffer>((done, fail) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (c: Buffer) => {
        size += c.byteLength;
        if (size > 60 * 1024 * 1024) req.destroy(new Error('too big'));
        else chunks.push(c);
      });
      req.on('end', () => done(Buffer.concat(chunks)));
      req.on('error', fail);
    });
  /** Imported songs, beside the projects that play them (same routes as the hosted store). */
  const handleFile = async (req: IncomingMessage, res: ServerResponse, parts: string[]) => {
    const name = parts[2] ?? '';
    if (parts.length !== 3 || parts[1] !== 'audio' || !FILE.test(name))
      return send(res, 400, 'Bad file name');
    const folder = join(dir, 'files', 'audio');
    const file = join(folder, name);
    const there = await stat(file).then(
      () => true,
      () => false,
    );
    if (req.method === 'HEAD') return send(res, there ? 200 : 204);
    if (req.method === 'GET') {
      if (!there) return send(res, 204);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.end(await readFile(file));
    }
    if (req.method !== 'PUT') return send(res, 405);
    const body = await readBytes(req);
    if (!there) {
      await mkdir(folder, { recursive: true });
      await writeFile(`${file}.tmp`, body);
      await rename(`${file}.tmp`, file);
    }
    return send(res, 200, '{"ok":true}', { 'Content-Type': 'application/json' });
  };
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const parts = new URL(req.url ?? '', 'http://sync').pathname.split('/').filter(Boolean);
    if (parts[0] === 'files') return handleFile(req, res, parts);
    if (parts[0] !== 'projects' || parts.length > 2) return send(res, 404);
    await mkdir(dir, { recursive: true });
    if (parts.length === 1) {
      if (req.method !== 'GET') return send(res, 405);
      const list = [];
      for (const name of await readdir(dir)) {
        if (!name.endsWith('.json')) continue;
        const file = join(dir, name);
        try {
          const doc = JSON.parse(await readFile(file, 'utf8')) as { title?: unknown };
          list.push({
            id: name.slice(0, -5),
            title: doc.title ?? {},
            updatedAt: (await stat(file)).mtimeMs,
          });
        } catch {
          // a half-written file: skip it
        }
      }
      return send(res, 200, JSON.stringify(list), { 'Content-Type': 'application/json' });
    }
    const id = parts[1] ?? '';
    if (!ID.test(id)) return send(res, 400, 'Bad id');
    const file = join(dir, `${id}.json`);
    const current = await readFile(file, 'utf8').catch(() => null);
    if (req.method === 'GET') {
      // 204, not 404: no copy yet is a normal answer, and browsers log every 404.
      if (current === null) return send(res, 204);
      return send(res, 200, current, { 'Content-Type': 'application/json', ETag: etagOf(current) });
    }
    if (req.method !== 'PUT') return send(res, 405);
    const text = await readBody(req);
    let doc: { format?: unknown; id?: unknown };
    try {
      doc = JSON.parse(text) as typeof doc;
    } catch {
      return send(res, 400, 'Not JSON');
    }
    if (doc.format !== 'imagination.story' || doc.id !== id)
      return send(res, 400, 'Not this story');
    const ifMatch = req.headers['if-match'];
    const ifNone = req.headers['if-none-match'];
    if (ifMatch === undefined && ifNone !== '*') return send(res, 428);
    if (ifNone === '*' ? current !== null : current === null || etagOf(current) !== ifMatch)
      return send(res, 412);
    await writeFile(`${file}.tmp`, text);
    await rename(`${file}.tmp`, file);
    return send(res, 200, '{"ok":true}', {
      'Content-Type': 'application/json',
      ETag: etagOf(text),
    });
  };
  const use = (server: {
    middlewares: {
      use(path: string, fn: (req: IncomingMessage, res: ServerResponse) => void): void;
    };
  }) => {
    server.middlewares.use('/sync', (req, res) => {
      handle(req, res).catch(() => send(res, 500));
    });
  };
  return { name: 'ie-sync-store', configureServer: use, configurePreviewServer: use };
}

// Bound to 127.0.0.1 only; the phone reaches it through `adb reverse` (see tools/phone).
export default defineConfig({
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
  build: { target: 'es2023', sourcemap: true },
  // ES workers can split: Beat This! (onnxruntime) loads into the analysis worker only on demand.
  worker: { format: 'es' },
  // onnxruntime finds its .wasm next to its own module; pre-bundling would move the module.
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  plugins: [
    react(),
    audioRelay(),
    syncStore(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Imagination Studio',
        short_name: 'Studio',
        description: 'Writes and builds interactive novels.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0f0f10',
        theme_color: '#0f0f10',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/fetch/, /^\/sync\//],
        // onnxruntime's ~30 MB .wasm is cached the first time Beat This! runs, not on install.
        runtimeCaching: [
          {
            // A function, not a regex: Workbox only lets a regex match a cross-origin URL from
            // its start, and the hosted Studio loads the .wasm from jsDelivr (ADR 0030).
            urlPattern: ({ url }) => url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: { cacheName: 'wasm', expiration: { maxEntries: 4 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
