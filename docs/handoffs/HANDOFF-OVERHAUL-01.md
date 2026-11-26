# HANDOFF-OVERHAUL-01 — Relational SQLite + Unified Nodes + 120 Hz UI Foundation

Branch `feat/overhaul-01-relational-node-foundation` off `main` @ `c16a75b`. Main session (Opus 5.5): Phases A, B core, D, E. Two `builder-sonnet` workers on disjoint folders: W1 `backup/` + `diagnostics/`; W2 `pick-cover` + `landscape-chrome`. `qa-runner` ran the final sweep.

## 1. Core v2 Unified Node Tree & Relational SQLite + FTS5

- **`packages/core/src/nodes/`** (now unfrozen; additive only, every v1 export unchanged):
  - Types `NodeKind` (8 kinds), `WorkspaceMode` (`prose` default / `interactive`), `NodeRecord`, `NodeBodyRecord`, `NodeLinkRecord`, `GrowthLogRecord`, `MediaAssetRecord`.
  - Pure helpers `sortNodes`, `isDescendant` (cycle-safe), `extractPlainText`, `extractMentionTargets` (`@Title`, longest match wins), `computeTodayWords`.
  - `nodes.test.ts`: 13 tests.
- **Schema `apps/writer/src/db/schema.ts`** (`PRAGMA user_version = 2`, file `kinetic-writer-v2.db`):
  - Opened with `WAL` + `foreign_keys = ON` + `synchronous = NORMAL`.
  - `nodes` has a self-FK on `parent_id`/`book_id` with ON DELETE CASCADE and `cover_asset_id → media_assets` with ON DELETE SET NULL. Indexes: `(parent_id, position)`, `(book_id, kind)`, `deleted_at`, `updated_at`.
  - `node_bodies`, `node_links` (PK `source,target,relation`, both FKs cascade) and `growth_logs` (`(node_id, date_key)`) all cascade from `nodes`.
  - Also `media_assets`, `settings`, and `gimmick_packs` / `gimmick_blueprints` (indexed by genre, engine, pack_id; scaffold only).
  - `nodes_fts` is `fts5(node_id UNINDEXED, title, plain_text, unicode61 remove_diacritics 2)`. It is kept in sync by triggers on every node/body insert, update and delete, and the delete trigger also fires on cascades. Trashed nodes are not indexed.
- **`DatabasePort`** (`db/port.ts`): coarse operations that are each atomic, e.g. `putNodes` (node + body + outgoing links), `deleteNodes`, `search`, `integrity`, `exportTables`, `replaceAll`.
  - Native `sqlite-driver.ts`: expo-sqlite. Writes run in exclusive transactions; reads come from an in-memory mirror hydrated on open (no blank frames); search runs FTS5 `bm25`.
  - `sqlite-driver.web.ts`: the same memory engine, persisted one localStorage key per table. No WASM.
  - `memory-driver.ts`: the Vitest engine. It enforces the same FKs, cascades and FTS semantics, using a binary-searched prefix index.
- **Store cutover:** `repository`, `folders` (split into `notes-docs` / `notes-nodes`), `trash`, `growth`, `demo`, `widget-sync`, `item-meta`, `novel-summary`, `RecentStrip`, `SearchView` and `RepositoryProvider` now all run on nodes.
  - Books, seasons and chapters keep speaking @kn/core v1 documents to the editor, export and publish; reading order is `position`.
  - Small sidecars (prefs, item meta, versions, publish/lock config) are JSON rows in `settings`.
  - `locked` and covers moved onto node columns and are joined into `ItemMeta` on read.
  - Saving a chapter or note refreshes `plain_text`, `nodes_fts` and its `@mention` `node_links`.
  - Search candidates come from `db.search` (FTS5); the existing ranker then only excerpts and highlights them.
  - Removed: the KV adapter, `CachedAdapter` and every content-key prefix.
- **Relational 30-day Trash:**
  - Trashing sets `deleted_at` and keeps `position`.
  - Every active query hides nodes that are trashed or under a trashed ancestor (`hiddenNodeIds`).
  - Restore clears `deleted_at` on the item and on any trashed ancestors.
  - Purge or Delete forever is `DELETE FROM nodes`, and the cascade wipes bodies, links and growth. Settings sidecars and unused `media_assets` are released. Files still referenced by another live asset are kept.
  - Proof: in `trash.test.ts`, `store/repository.test.ts` and `sqlite-schema.test.ts`, `integrity()` reads 0 orphan bodies, links and growth, and `ftsRows === activeNodes`. The QA gate shows `nodes_fts 3 = active 3` after Empty trash.
- **100k-word FTS benchmark** (100 chapters × 1,000 words; prefix, phrase and AND queries; asserted `< 15 ms`):
  - **Real SQLite 3.53 FTS5** running the production schema and `SEARCH_SQL` (`node:sqlite`, `sqlite-schema.test.ts`): **0.46 / 0.48 / 1.23 / 1.28 ms**.
  - Memory/web engine: **0.05 / 0.05 / 0.26 / 0.16 ms**.
- **Backup v2 / Document Doctor v2 (W1):**
  - `.zip` contains `manifest.json` (`formatVersion: 2`), `tables/*.json` and `covers/` (cover + `.thumb.jpg`).
  - Restore is strict: name allow-list, no traversal, size and count caps, row-shape checks, chapter bodies validated against @kn/core. It then calls `replaceAll`, which is atomic and rebuilds FTS. Lock and publish secrets are never exported or overwritten; v1 archives are rejected cleanly.
  - `.knbook` excludes trashed subtrees, re-ids on collision and seeds baselines.
  - Doctor checks: broken parents and cycles, invalid bodies and modules, missing cover files, the FTS row count (repair: rebuild), orphan rows, sidecars and corrupt settings.

## 2. Gate 3 Fixes Verified

- **C2t covers:** `cover-pipeline.ts` renders **both** the 1200×1800 cover (q 0.84) and the 240×360 `.thumb.jpg` (q 0.80) from the **picked `asset.uri`**, then moves both into `covers/`.
  - Both are registered as `media_assets` (`cover` + `cover_thumb`) and set via `setItemCover` → `nodes.cover_asset_id`.
  - `pick-cover.test.ts` proves both renders read the source URI, never `dest`. If the thumbnail fails, `thumb: null`; if the cover fails, the original is copied.
- **Bug 3 day-0 baseline:** creating, importing or restoring a chapter (and its book) writes `is_baseline = 1` growth rows; `computeTodayWords` subtracts them.
  - `growth.test.ts`: 3 words typed into a 118-word chapter → `todayWordsForBook = 3`. Seeding the demo → 0. A trash restore → 0.
  - `widget-state.test.ts`: the same case renders "**3 words today**".
- **Obs #4:** `landscape-chrome.ts` `shouldAutoCollapseMetrics` collapses when the keyboard is up, the window is landscape and `windowHeight < 500` (6 tests), via `use-ribbon-collapse.ts` in `ChapterEditor`. The Author's own toggle is kept and returns when the IME hides or the device rotates.
  - Web QA treats "focused field on a touch device" as the IME (`use-web-ime.web.ts`; ribbon only).

## 3. 120 Hz UI-Thread Motion & Keyboard Foundation

- Installed via `npx expo install`: **react-native-reanimated 4.7.1**, **react-native-gesture-handler ~3.3.0**, **react-native-keyboard-controller 1.22.7**, **react-native-worklets 0.13.0**.
  - No `babel.config.js` is needed: SDK 58's `babel-preset-expo` auto-adds `react-native-worklets/plugin`. Metro and Vitest are green.
  - **Fallback guard was not triggered:** keyboard-controller passes prebuild and `compileReleaseKotlin`.
- `_layout.tsx` is wrapped in `MotionProviders` (`GestureHandlerRootView` + `KeyboardProvider`; web: RNGH only) outside `SafeAreaProvider`. The inner child tree order is unchanged.
- **`RootTabsPager.tsx` (native):** RNGH v3 `usePanGesture` (the v3 hook form of `Gesture.Pan()`) + `useSharedValue` / `useAnimatedStyle` / `withSpring` (`overshootClamping`, release velocity). Finger tracking and the settle are 100% worklets.
  - Manual activation applies the 32 dp edge dead zones, horizontal-intent claim, vertical fail and the RecentStrip carousel yield, all through worklet-safe `tab-pager-math`.
  - Rail and Reduce Motion are instant. Leaving Search runs `Keyboard.dismiss()`. Back unwinds Notes/Search → Library → exit (`pager-shell.tsx`, shared with `RootTabsPager.web.tsx`, which keeps PanResponder).
- **16 KB ELF** (`build-android-apk.ps1 -Abi all` release APK + `verify-android-artifact.mjs`): new `libreanimated`, `libworklets`, `libexpo-modules-worklets`, `libgesturehandler` and `libreact_codegen_rngesturehandler_codegen` are **0x4000 PASS on arm64-v8a and x86_64**. keyboard-controller ships no `.so` (Kotlin only). Whole APK: 60 pass · 0 fail · 60 skip (32-bit); zipalign 16 KB PASS.

## 4. Prebuild & Verification Sweep (`@qa-runner`)

- `expo prebuild --platform android --clean --no-install`: OK. `gradlew :app:processReleaseMainManifest :app:compileReleaseKotlin`: **BUILD SUCCESSFUL** (2 m 53 s).
- Merged release manifest: `targetSdkVersion="36"` ✓, `allowBackup="false"` ✓, `dataExtractionRules` + `fullBackupContent` ✓, `autoVerify="true"` ✓, `KnWriterWidgetProvider` ✓, **`enableOnBackInvokedCallback`: 0**, **restricted permissions: 0**.
- `pnpm check`: typecheck ×3 ✓, ESLint 0 warnings, **Vitest 100 files / 995 tests passed** (6.2 s; 28 s wall-clock).
- `pnpm build` + `bundle-report.mjs`: **reader initial JS 19.5 KB gz** (≤ 20.0 KB). No lazy chunk over budget.
- `writer:export` + `writer-shots.mjs` (+ `smoke-publish`, tablet): **198 ✅ / 0 ❌**, zero console/page errors in every pack. QA seeding was ported to v2 (`scripts/lib/writer-v2.mjs`, opt-in `kn-writer-v2:qa` hook).
- `git diff c16a75b -- apps/reader`: **empty**. No changed source file is over 250 lines.

## 5. Captured QA Screenshots (`qa-shots-overhaul01/`, git-ignored)

- `01-v2-library-and-fts-search.png`: Library from v2 nodes beside FTS results for `lant` (a note plus 2 chapter hits).
- `02-doctor-v2-all-clear.png`: Doctor "All clear" after Trash → Empty trash.
- `03-landscape-metrics-autocollapse.png`: 844×390 editor with the keyboard up and the ribbon collapsed.

## 6. Ready-for-Overhaul-02 Notes & Open Decisions

- **Workspace mode** is stored and toggleable (`repo.get/setWorkspaceMode`; the demo is `interactive`, new books are `prose`), but no UI reads it yet. OVERHAUL-02 decides what the `prose` mode hides.
- **Rich editor:** chapter/note bodies are `blocksJson` + derived `plain_text`. `react-native-enriched-markdown` must still round-trip into @kn/core blocks (or a v2 body format behind `NodeBodyRecord`). FTS and mentions only need `plainTextOf()`.
- **Keyboard:** `KeyboardProvider` is mounted but no screen consumes its hooks yet. `useKeyboardDock` still uses RN `Keyboard` events (resize-agnostic math). Migrate the editor dock to `useReanimatedKeyboardAnimation` in 02.
- **Character/location/lore** kinds and `@mention` backlinks are live in the data layer only. Mentions currently resolve against notes plus those kinds. Backlink UI and a Story-Bible node type are open product decisions.
