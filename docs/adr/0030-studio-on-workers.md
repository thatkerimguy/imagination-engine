# 0030 — The hosted Studio on Cloudflare Workers, runtime wasm from a CDN

**Status:** accepted · 2026-11-11

## Context

The private Studio was built for Cloudflare Pages (`pnpm publish:studio --pages`). Cloudflare now
steers new Git-connected projects to Workers with static assets, and its "Create an app" setup
runs a build command and then `npx wrangler deploy` from the repository root. Both products
refuse any file over 25 MiB. onnxruntime-web's WebGPU build (used by beat analysis and stem
separation) ships a 27.4 MiB `.wasm`, so every deploy failed.

## Decision

**A Worker with static assets.** `wrangler.jsonc` at the root serves `out/studio/public` as
assets, falls back to `index.html` for unknown paths (single-page app), and runs
`tools/publish/studio-worker.mjs` first only for `/fetch` and `/sync/*`. That Worker calls the
existing Pages Functions (`studio-functions/fetch.js`, `sync.js`) unchanged, so the
`--pages` path keeps working. The Git build command is `pnpm publish:studio`.

**The onnxruntime wasm comes from jsDelivr on the hosted Studio.** Every import of
onnxruntime-web goes through `loadOrt()` in `@ie/audio`. A build made with
`VITE_ORT_WASM_CDN=1` (which `publish:studio` sets) points `ort.env.wasm.wasmPaths` at
`cdn.jsdelivr.net/npm/onnxruntime-web@<bundled version>/dist/`. The publish script leaves out
any file over 25 MiB and lists what it left out. Local dev, `pnpm build` and the Player still
serve the wasm themselves.

**The site stays behind Cloudflare Access.** The `/fetch` relay and sync must not be public.
Preview builds stay off, because preview URLs are not covered by the production Access rule
unless one is added for them.

## Consequences

- The first beat analysis or stem split on the hosted Studio needs jsDelivr to be reachable;
  after that the service worker's `wasm` runtime cache keeps it offline.
- Adding a CSP later must allow `cdn.jsdelivr.net` in `connect-src` and `script-src`.
- Device sync needs an R2 bucket bound as `SYNC` (the commented block in `wrangler.jsonc`).
- Cloudflare builds the branch set in the project (usually `main`), so changes reach the hosted
  Studio once they are merged there (`publish.bat`).
