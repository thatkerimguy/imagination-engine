// Writer built-in offline preview: the `?preview=1` reader as ONE self-contained HTML file.
// Every lazy chunk (modules, three.js, cannon-es) is inlined so the WebView never fetches.
// Used only by scripts/build-preview-bundle.mjs; the public PWA build (vite.config.ts) is untouched.
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  base: './',
  logLevel: 'warn',
  build: {
    target: 'es2022',
    sourcemap: false,
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    chunkSizeWarningLimit: 4096,
    emptyOutDir: false,
    write: false,
    rollupOptions: {
      input: resolve(import.meta.dirname, 'offline-preview/index.html'),
      output: { codeSplitting: false },
    },
  },
});
