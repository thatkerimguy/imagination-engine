import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Bound to 127.0.0.1 only; the phone reaches it through `adb reverse` (see tools/phone).
export default defineConfig({
  // Relative paths, so the build works from any folder on a host (e.g. GitHub Pages' /repo/).
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { target: 'es2023', sourcemap: true },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        // The id stays '/' so installed copies keep their identity; it's only an identifier.
        id: '/',
        name: 'Imagination Player',
        short_name: 'Player',
        description: 'Reads interactive novels.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f4f1ea',
        theme_color: '#f4f1ea',
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
        // wasm: hyphenation patterns, so Turkish breaks correctly offline too.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'],
        navigateFallback: 'index.html',
      },
      devOptions: { enabled: false },
    }),
  ],
});
