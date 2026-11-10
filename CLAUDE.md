# Imagination Engine

A modular, browser-based engine and Studio for interactive text novels, used privately; some novels
may be published. `PLAN.md` is the product plan and roadmap; `docs/adr/` records settled decisions.
Read both before large changes, and don't re-argue an ADR without writing a new one.

The owner builds content **without writing code**. Everything a creator does must be possible in the
Studio through forms, blocks, graphs, and timelines. Code is for engine development only.

## Commands

```bash
pnpm dev            # Player on http://127.0.0.1:5173, Studio on http://127.0.0.1:5174
pnpm phone          # adb reverse + open the Player on the connected Android phone (--studio, --preview, --diag, --hud)
pnpm build          # production builds of both apps (PWA)
pnpm preview        # serve builds on 127.0.0.1:4173 / 4174 (use this to test offline install)
pnpm check          # typecheck + lint + unit tests: run before calling any task done
pnpm e2e            # Playwright smoke tests (uses installed Microsoft Edge)
pnpm icons          # regenerate PWA icons from tools/icons/*.svg
run.bat [preview]   # Windows: install if needed, start dev (or build + preview), open the Player
publish.bat         # build the Player and push it to the `deploy` branch (host files only)
```

Dev servers bind to `127.0.0.1` only. Never change that to `0.0.0.0`; the phone connects through
`adb reverse`, which also makes `http://127.0.0.1` a secure context on the phone.

## Layout

```
packages/core         kernel, modules, action bus, event bus, state store, services, ids, storage
packages/i18n         locales (en, tr), Turkish casing/collation/search, suffixes, hyphenation, catalogs
packages/story        story schema, formulas, text markup, the interpreter (no DOM)
packages/present      DOM presenter: layouts, effects, typewriter, choices (no UI framework)
packages/samples      sample stories as JSON (The Rain Alley), with an auto-play test
packages/ui-kit       design tokens, Paper/Night themes, fonts (latin + latin-ext), theme helpers
packages/diagnostics  device/GPU report, refresh-rate probe, performance HUD
apps/player           vanilla TS reader shell (PWA): story session, saves, rewind, panels; no UI framework
apps/studio           React 19 + Zustand Studio (PWA): project store + undo, Write, Flow, Data, Play
tools/phone           adb helper behind `pnpm phone`
tools/icons           icon sources + generator
e2e                   Playwright smoke tests (desktop + Redmi Note 12 viewport)
docs/adr              architecture decision records
```

Packages are consumed as TypeScript source (`exports` points at `src/index.ts`); there is no
per-package build step.

## Hard rules

1. **Package boundaries.** Import other packages only through their public entry (`@ie/core`), never
   `@ie/core/src/...` or relative paths into another package. ESLint enforces this.
2. **Player stays framework-free.** `apps/player` and every `packages/*` runtime package must not
   import React or any UI framework. React lives in `apps/studio` only.
3. **Schemas for data.** Anything that is saved, loaded, sent through the action bus, or edited in
   the Studio has a Zod schema. Validate at boundaries; never trust raw JSON.
4. **Every user-facing string in both languages.** Add it to the app's message catalog for `en` and
   `tr` (the type system enforces matching keys). Use `@ie/i18n` helpers for casing, sorting, and
   search; never call `toUpperCase()` on user text (Turkish i/İ, ı/I).
5. **Design tokens only.** Colours, spacing, type, radii, and motion come from CSS variables in
   `@ie/ui-kit/tokens.css`. No hard-coded colours in components. The UI is quiet: no gradients, no
   decorative motion, no branding.
6. **Tests for logic.** Pure logic (kernel, buses, state, i18n, formatting) needs Vitest tests next to
   the source (`*.test.ts`). UI changes must keep `pnpm e2e` green.
7. **Small files.** Aim for under ~400 lines per file (lint warns). Split by responsibility.
8. **Performance budget.** The reference device is a Redmi Note 12 4G (Adreno 610). See PLAN.md
   §11.1. Don't add per-frame work to the reader without measuring it on the phone or with the HUD.
9. **Browser storage.** `localStorage` only for per-device UI preferences, always through the safe
   helpers in `@ie/ui-kit` (they swallow errors in private mode). Project data goes through
   `@ie/core` storage (IndexedDB / OPFS).
10. **TypeScript 6.0 is pinned** (`~6.0.3`) because typescript-eslint doesn't support 7.x yet. Don't
    bump it until typescript-eslint does.

## Conventions

- IDs come from `createId()` in `@ie/core` (prefix + random base62). Never use array indexes as IDs.
- Action ids are `domain.verb` (`ui.locale.set`, `audio.play`). Event names are `domain.pastTense`
  (`locale.changed`).
- Modules: `defineModule({ id, depends, install(ctx) })`. Modules register actions, services, and
  event listeners in `install`, and clean up in `dispose`.
- Prefer plain functions and small classes; no global singletons except the app's own kernel.
- Comments explain _why_, not _what_.

## Definition of done (per task)

1. `pnpm check` passes.
2. `pnpm e2e` passes when UI changed.
3. New user-facing text exists in English and Turkish.
4. If a decision was made that future work must respect, add an ADR in `docs/adr/`.
5. Checked on the phone (`pnpm phone`) when the change affects layout, input, audio, or performance.
