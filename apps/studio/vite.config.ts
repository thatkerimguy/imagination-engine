import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
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
        navigateFallbackDenylist: [/^\/fetch/],
        // onnxruntime's ~30 MB .wasm is cached the first time Beat This! runs, not on install.
        runtimeCaching: [
          {
            urlPattern: /\.wasm$/,
            handler: 'CacheFirst',
            options: { cacheName: 'wasm', expiration: { maxEntries: 4 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
