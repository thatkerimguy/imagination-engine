# Phase 2 (Pass 1) Implementation Report

## Git & Build Verification

- Branch pushed: `main` and `claude/fervent-knuth-rfks3y` (verified code at commit `40addbf`; this
  report is the commit after it)
- Subagents used:
  - **Main Opus session:** Expo scaffold and Metro/TS/ESLint wiring; storage adapters,
    repository, outline ops, demo seed, chapter ops, sanitize, autosave, live drafts and hooks;
    writer module registry; UI primitives; reader `?preview=1` bridge and `mountChapter`
    refactor; writer Live Preview screen and WebView/iframe host; app settings; integration
    fixes (auto-growing prose inputs, insert bar, badge layout); `smoke-preview.mjs` and
    `writer-shots.mjs`.
  - **`@builder-sonnet` ×4 (in parallel):** SchemaForm engine, the 10 controls and GimmickSheet;
    Bookshelf, New Novel, Outline and Novel Settings; Chapter Editor block UI; store, boundary
    and protocol unit tests.
  - **`@qa-runner`:** the full verification run below.
- `pnpm check`: **PASS**. 20 test files, 110 tests, lint at 0 warnings, typecheck covers both
  `tsconfig.json` and `apps/writer/tsconfig.json`.
- `apps/reader` `bundle-report.mjs`: **PASS**
  ```
  Initial reader JS (gzipped):
    assets/main-BvlMM5Vn.js  5.7 KB
    assets/lazy/module-host-DeKpINbN.js  12.4 KB
    total 18.1 KB / budget 40.0 KB ✅
  ```
  The preview bridge is its own lazy chunk (`view-*.js`, 0.9 KB). The initial chunks contain no
  `three` or `cannon-es` code (grep is clean).
- `apps/writer` Zero-Heavy-Imports check: **PASS**, verified three ways:
  1. `apps/writer/src/boundary.test.ts` (9 tests) scans every writer import. It walks each
     `@kn/module-*` barrel transitively and checks `package.json` deps, plus a self-test.
  2. The ESLint `no-restricted-imports` fence on `apps/writer/src/**`.
  3. `expo export --platform web` output grepped for `WebGLRenderer|cannon-es|ContactMaterial|three.module`, with no matches.
- Preview bridge and `smoke.mjs`: **PASS**. All Phase 1 checks still pass, with zero console
  errors. A new pass renders an unsaved draft (edited headline and dialogue, tier `lite`) via
  `postMessage` and rejects an invalid draft.
- Writer QA (`scripts/writer-shots.mjs`): **PASS**. Covers the seeded shelf, outline and module
  toggles, pills built from `formatCardSummary`, `showWhen`, the live preview of an edited line
  through the iframe bridge, autosave surviving a reload, and the gimmick picker being filtered.
  Zero console errors.
- Metro bundling: `expo export --platform web` passes (11 bundles).
  `expo export --platform android` passes, producing a 3.5 MB Hermes bundle.

## Architecture & How Key Pieces Work

### Storage adapter and repository

- **Files and entry points:**
  - `apps/writer/src/storage/{types,adapter,adapter.web,memory}.ts`
  - `src/store/{documents,repository,outline,demo,ids,errors}.ts`
- **How it works:**
  - A 4-method key-value contract. Native uses one `expo-sqlite` table
    `kv(key, value, updated_at)` (WAL). Expo Web uses `localStorage` and falls back to memory;
    tests use memory. Metro chooses the variant through the `.web.ts` extension.
  - `NovelRepository` stores `novel/…`, `season/…` and `chapter/…` JSON documents, each with an
    `updatedAt`. Every write goes through the `@kn/core` parsers, and `importBundle` validates
    everything before it writes anything.
  - IDs come from `ulid()` in `@kn/core`. Blocks use the canonical ULID. Novel, season and
    chapter IDs use the lowercased ULID, which is a valid core slug.
  - On first launch the store seeds "Chrome Tide" from `sample-novels/vertical-slice`. Bookshelf
    has "Load demo novel", which resets the demo after a confirm. Export is novel or chapter JSON
    via `src/export/share-json` (file plus share sheet on native, file download on web).
- **Edge cases handled:**
  - Invalid manifests are never stored.
  - Unfinished blocks (empty prose, dialogue without a speaker) stay in the editor but are left
    out of saves and previews, and show an amber "Not saved until filled in" hint. This keeps
    every stored chapter core-valid. The trade-off is that an unfinished block is lost on reload.
  - Deleting the demo never re-seeds it.

### Writer module registry

- **Files and entry points:** `src/modules/registry.ts`
- **How it works:**
  - Imports only `schema` and `formatCardSummary` from each module barrel.
  - Erases prop types into a `WriterModule`.
  - `summarize()` validates first, then formats. If the props are invalid it returns a fallback
    card with a `FIX` badge.
- **Edge cases handled:**
  - Unknown `enabledModules` IDs are ignored.
  - A block whose module is disabled keeps its pill, tagged "Not enabled in this novel". Its sheet
    shows a warning, and the reader skips the block.
  - A block whose module is not registered shows "Unknown gimmick" and cannot be edited.

### SchemaForm, `showWhen` and GimmickSheet

- **Files and entry points:**
  - `src/forms/form-state.ts` (pure, unit-tested)
  - `src/forms/SchemaForm.tsx`
  - `src/forms/controls/*`
  - `src/forms/GimmickSheet.tsx`
  - `src/ui/BottomSheet.tsx` (RN `Modal`, no gesture or animation libraries)
- **How it works:**
  - Fields come from `schema.fields`, filtered by `isFieldVisible`.
  - `schema.validate()` runs on every change. `"key: msg"` errors map to their field, and
    anything else shows at the top.
  - Save stays disabled until the props are valid.
  - "Reset to defaults" reloads `schema.defaults`.
  - There is no per-module code.
- **Edge cases handled:**
  - Toggling `showWhen` keeps hidden values.
  - Cross-field refine errors land on their field, for example `scriptedNumbers` when its length
    doesn't match `count`.
  - Numbers snap float-safely to `step`.
  - List min and max item counts are honoured.
  - Errors on hidden fields surface at the top, so Save never fails silently.

### Chapter Editor state and autosave

- **Files and entry points:**
  - `src/store/{use-chapter-draft,autosave,chapter-ops,sanitize,live-drafts}.ts`
  - `src/editor/*`
  - `src/app/novel/[novelId]/chapter/[seasonId]/[chapterId].tsx`
- **How it works:**
  - All edits are pure, immutable block ops applied through `update()`.
  - A 600 ms debounced autosaver never runs two saves at once; the newest value saves after the
    one in flight.
  - Pending saves flush on unmount, when the app goes to the background, and before Preview.
  - The header shows Saved / Saving… / Edited / Save failed.
- **Edge cases handled:**
  - Rapid typing collapses into one write.
  - A save error is shown in the header.
  - The `beatStop` toggle adds or removes the key and gives `expo-haptics` feedback (skipped on
    web).
  - Move up and down stop at the bounds.
  - Delete asks for confirmation.
  - The "+ Gimmick" picker lists only `enabledModules`, and says how to enable modules when none
    are on.

### Reader preview bridge and WebView host

- **Files and entry points:**
  - Reader: `apps/reader/src/preview/{protocol,view}.ts`, `apps/reader/src/views/reading.ts`
    (`mountChapter`), and the lazy `import()` in `app.ts`.
  - Writer: `src/preview/{protocol,PreviewFrame,PreviewFrame.web,use-preview-payload}.ts(x)`
    and `src/app/preview.tsx`.
- **How it works:**
  - The reader opens with `?preview=1` and posts `kn-preview-ready`.
  - The writer answers with `kn-preview-load {novel, season, chapter, startBlockId?, tier}`. The
    chapter is the live, unsaved editor draft after sanitizing.
  - The reader validates the message with `@kn/core`, renders the real reading view (drafts
    included), and replies `kn-preview-rendered` or `kn-preview-error`.
  - Transport is `ReactNativeWebView.postMessage` plus `injectJavaScript` on native, and
    `window.postMessage` with an `<iframe>` on web.
  - The curtain appears once per session, to unlock audio. Preview never writes bookmarks or
    changes the URL.
- **Edge cases handled:**
  - If the Reader URL can't be reached, the screen shows a banner after an 8 s ready timeout or
    on a WebView load or HTTP error, with Retry and "Change reader URL" actions.
  - An invalid URL in Settings is caught before loading.
  - Changing the tier re-sends the load. "Restart" remounts the WebView.
  - A start block that no longer exists falls back to the top of the chapter.

## Known Limitations / Real-Device Notes

- **Not run on a physical phone.** Native SQLite, `expo-haptics`, keyboard avoidance (the iOS
  offset is approximate), the share sheet, `expo-document-picker` and WebView `injectJavaScript`
  are verified only by typecheck and the Android Hermes bundle. Please smoke-test them in a dev
  build or Expo Go.
- **The reader on the LAN:** Vite binds `127.0.0.1`. For a phone, run `pnpm dev --host` and set
  the writer's Reader URL to the computer's LAN IP. Audio and motion sensors need HTTPS or
  `localhost`.
- **Custom asset paths:** in preview these resolve against `novels/<id>/` on the reader server,
  so files picked for novels that aren't published won't play yet. The picker stores
  `assets/<name>`, and copying the file into the bundle is Phase 3.
- **CLAUDE.md §3.1 conflict, flagged for the Author:** adding a module still needs one registry
  line plus the `@kn/module-<id>` dependency in `apps/writer`, as this Directive's explicit
  registry requires. Auto-discovery (for example Metro `require.context`) could remove that in a
  later pass.
- **Preview start block:** starting at a mid-chapter block uses the reader's existing
  bookmark-restore path. Beats above that block can fire as the chapter mounts. This is
  Phase 1 behaviour, unchanged here.
- **Other choices:**
  - Prose style `body` and empty optional fields are dropped on save.
  - Status badges cycle draft → unlisted → published on tap.
- `apps/writer/dist` is about 1.8 MB of Expo Web JS. Only the QA harness uses it; the writer
  ships as a native app.
