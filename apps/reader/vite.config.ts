import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const NOVELS = resolve(import.meta.dirname, '../../sample-novels');

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

/** Serves sample-novels/ at /novels in dev and copies it into the build (published books are static files). */
function novels(): Plugin {
  return {
    name: 'kn-novels',
    configureServer(server) {
      server.middlewares.use('/novels', (req, res, next) => {
        const path = resolve(NOVELS, `.${decodeURIComponent((req.url ?? '/').split('?')[0]!)}`);
        if (!path.startsWith(NOVELS)) return next();
        try {
          const body = readFileSync(path);
          res.setHeader(
            'Content-Type',
            path.endsWith('.json') ? 'application/json' : 'application/octet-stream',
          );
          res.setHeader('Cache-Control', 'no-cache');
          res.end(body);
        } catch {
          next();
        }
      });
    },
    generateBundle() {
      for (const file of listFiles(NOVELS)) {
        this.emitFile({
          type: 'asset',
          fileName: `novels/${relative(NOVELS, file).replaceAll('\\', '/')}`,
          source: readFileSync(file),
        });
      }
    },
  };
}

// Dev servers bind to 127.0.0.1; phones reach them through `adb reverse` or a tunnel.
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    // three.js is one ~540 KB lazy chunk by nature; it never loads unless a 3D module runs.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        sandbox: resolve(import.meta.dirname, 'sandbox/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        // Everything lazy (modules, three.js, physics) lives under assets/lazy/, which the
        // service worker caches on first use instead of precaching for every reader.
        chunkFileNames: 'assets/lazy/[name]-[hash].js',
      },
    },
  },
  plugins: [
    novels(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: './',
        name: 'Kinetic Reader',
        short_name: 'Reader',
        description: 'Kinetic novels for the open web.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#16171a',
        theme_color: '#16171a',
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
        globPatterns: ['*.{html,svg,png}', 'assets/*.{js,css}'],
        globIgnores: ['sandbox/**', 'assets/sandbox-*'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/sandbox\//, /\/novels\//],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/lazy\//,
            handler: 'CacheFirst',
            options: { cacheName: 'lazy-chunks' },
          },
          {
            urlPattern: /\/novels\/.+\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'novels' },
          },
          {
            urlPattern: /\/novels\/.+\/assets\//,
            handler: 'CacheFirst',
            options: { cacheName: 'novel-assets' },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
