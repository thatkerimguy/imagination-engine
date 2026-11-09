# 0002 — Stack and monorepo

**Status:** accepted · 2026-11-09

## Context

The engine needs a fast, typed toolchain that works well with AI-written code and runs entirely on
the owner's PC, with the phone attached over adb.

## Decision

- **TypeScript (strict)**, **Vite 8**, **pnpm workspaces**, **Vitest**, **Playwright**, **ESLint**
  (typescript-eslint, type-aware) and **Prettier**.
- **TypeScript is pinned to 6.0.x.** TypeScript 7 (the native compiler) is out, but typescript-eslint
  only supports `<6.1`. Revisit when typescript-eslint adds 7.x support.
- Workspace packages are consumed **as source** (`exports` → `src/index.ts`). No per-package builds;
  Vite compiles everything. One root `tsconfig.json` typechecks the whole repo.
- **Zod** for every schema.
- Playwright runs against the installed **Microsoft Edge** (`channel: 'msedge'`), so no browser
  downloads are needed.
- Dev and preview servers bind to **127.0.0.1** with fixed ports: Player 5173 / 4173, Studio 5174 / 4174. The phone reaches them through `adb reverse`.

## Consequences

- Adding a package = folder + `package.json` with `exports`, then `pnpm install`.
- Anything not compatible with TS 6.0 or Vite 8 needs a workaround or an ADR.
