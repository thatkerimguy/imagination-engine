# DIRECTIVE 02 — Native Mobile Writer Alpha (`apps/writer`) & Live Preview Bridge

You are working in an **Orchestrator → Implementer** loop on branch `main` of `imagination-engine`. Phase 1 (`DIRECTIVE 01`) is signed off and merged on `main`.

> **Read First:** Read `CLAUDE.md` and the Phase 2 section of `PROJECT_PLAN.md` before writing code. Follow every architectural fence and every item on the **NEVER BUILD** list strictly.
> **Scope File:** This file is the active scope. Directive 01 is archived at `docs/directives/directive-01-core-reader-sandbox.md`.

---

## 1. Execution Strategy & Subagent Split (Quota-Efficient Workflow)

This repository includes `.claude/settings.json` (`1h` subagent cache TTL) and two project subagents in `.claude/agents/`. Use them deliberately to save quota and keep your main context clean:

* **Main Session (Opus 5.5 Medium — Lead Architect):**
  1. Inspect `packages/core/src/*`, `packages/modules/*/index.ts`, `packages/modules/*/schema.ts`, `packages/modules/*/card.ts`, `apps/reader/src/views/reading.ts`, and `PROJECT_PLAN.md` (Phase 2).
  2. Scaffold `apps/writer` (Expo + Expo Router + `pnpm` workspace Metro config + strict TypeScript + ESLint wiring).
  3. Build the offline-first persistence layer (`expo-sqlite` + `expo-file-system` / web storage fallback for QA), sample-novel importer (`sample-novels/vertical-slice`), and core state/repository hooks.
  4. Build the writer module registry (`apps/writer/src/modules/registry.ts`) importing **ONLY** barrel exports (`schema`, `formatCardSummary` — never `renderer.ts`).
  5. Build the lightweight **Live Preview Bridge** in `apps/reader` (`?preview=1` `postMessage` receiver) and wire `apps/writer`'s embedded `react-native-webview` Preview screen.
  6. Review subagent outputs, fix integration seams, and push verified commits to `origin/main`.
* **Delegate to `@builder-sonnet` (Sonnet 5.5 Medium — Scoped Parallel Workers):**
  * Once you have locked the folder layout, store interfaces, and route signatures, delegate clearly scoped, independent chunks:
    1. **Schema-Driven Form Engine:** `SchemaForm` + native mobile controls for all 10 field types from `packages/core/src/module-contract.ts` (`text`, `multiline`, `number`, `toggle`, `select`, `multi-select`, `color`, `string-list`, `number-list`, `asset`) with `showWhen` conditional visibility and live validation display.
    2. **Library & Settings Screens:** Bookshelf (`/`), Season/Volume & Chapter tree, Novel Settings (title/subtitle/author, `sectionLabel`, reading theme tokens, and `enabledModules` toggles).
    3. **Chapter Editor Block UI:** Continuous vertical stream of editable blocks (`prose`, `dialogue`, `scene-break`, `module` summary pill using `formatCardSummary`), quick-insert toolbar, block reorder (up/down), delete with confirmation, and `beatStop` toggle with `expo-haptics`.
    4. **Unit Tests:** Store CRUD & validation tests, `showWhen` & schema form state tests, and the **Zero Heavy Imports** boundary test.
* **Delegate to `@qa-runner` (Haiku 5.5 Medium — Read-Only Checks & Logs):**
  * Run `pnpm check`, `pnpm build` (checking `scripts/bundle-report.mjs`), Expo Metro bundle checks, and Playwright smoke/screenshot captures. Never pull full raw build logs into your main session—rely on `@qa-runner`'s concise pass/fail summary.

---

## 2. Objective & Non-Negotiable Guardrails

Build **`apps/writer`**, a fast, offline-first Expo (React Native) mobile authoring app where the Author writes linear kinetic novels (`Book → Season → Chapter → Block`) and configures gimmicks through auto-generated native bottom sheets—**never writing JSON, code, or custom text markup**—with instant embedded WebView live preview powered by `apps/reader`.

### Hard Architectural Rules (Must Pass Audit)
1. **Frozen Core Rule:** Do **NOT** modify `packages/core/` unless you discover an actual blocking bug (if so, document why and keep changes minimal and backward-compatible).
2. **Zero Heavy Imports in Writer:** `apps/writer` MUST NEVER import `three`, `cannon-es`, WebGL/GLSL code, Web Audio renderers, or any `packages/modules/*/renderer.ts` file. It imports ONLY each module's pure barrel (`index.ts` → `schema` + `formatCardSummary`). Add an automated test verifying this boundary.
3. **Schema-Driven Gimmick UI:** Never hand-code a bespoke settings screen for `bl-dice-3d`, `gits-cyberbrain-chat`, or `core-ambient-bed`. Every gimmick editor bottom sheet MUST be dynamically generated from `schema.fields`, `schema.defaults`, and `schema.validate()`.
4. **Reader Bundle Budget Preserved:** Adding the preview `postMessage` bridge to `apps/reader` MUST keep the initial reader JS bundle strictly `< 40 KB` gzipped (Phase 1 ended at `18.0 KB`) with zero `three`/`cannon-es` leakage into initial chunks.
5. **Keep Files Small & Strictly Typed:** `strict: true`, zero `any`, target `< 250` lines per file.

---

## 3. Deliverables

### Deliverable A: Expo Workspace Scaffolding (`apps/writer`)
* Initialize `apps/writer` inside the existing `pnpm` monorepo using **Expo + Expo Router** + TypeScript (`strict: true`).
* Configure `metro.config.js` cleanly for `pnpm` monorepo resolution (`watchFolders` including workspace root / `packages/`, `nodeModulesPaths`, symlink resolution) so `@kn/core` and `@kn/module-*` resolve cleanly in Metro.
* Wire `apps/writer` into root workspace scripts (`pnpm typecheck`, `pnpm lint`, `pnpm test`) so `pnpm check` validates both `apps/reader` and `apps/writer`.

### Deliverable B: Offline-First Local Store & Sample Seed
* Persist Books, Seasons, Chapters, and ordered Blocks locally using `expo-sqlite` (with a clean storage adapter abstraction so unit tests and Expo web preview run smoothly using an in-memory / `localStorage` fallback adapter).
* Generate stable ULIDs for every new book, season, chapter, and block using `@kn/core`'s ID helper.
* Validate manifests and chapter documents through `@kn/core` validators before saving/exporting.
* Provide a one-tap **"Load Demo Novel (Chrome Tide)"** seed/import action (or automatic first-launch seed when empty) populated from `sample-novels/vertical-slice` so the Author can immediately edit and preview a working book.
* Support **Local JSON Export** (exporting a novel or chapter JSON cleanly via Expo share/clipboard/file) as an offline backup ahead of Phase 3 publishing.

### Deliverable C: Authoring Flows & Screens
1. **Bookshelf Screen:**
   * List all local novels with title, author, season/chapter count, and last-edited timestamp.
   * Create new novel (title, subtitle, author, `sectionLabel`: `"Season"` | `"Volume"` | `"Arc"`).
2. **Book Outline (Seasons & Chapters) Screen:**
   * Expandable/structured list of Seasons (using the novel's `sectionLabel`) and their Chapters with status badges (`draft` | `unlisted` | `published`).
   * Add/rename/reorder seasons and chapters.
   * Access **Novel Settings**: edit metadata, theme accent overrides, and toggle `enabledModules[]` (selecting from registered modules in `apps/writer/src/modules/registry.ts`).
3. **Continuous Mobile Chapter Editor Screen:**
   * Clean, distraction-free mobile writing surface displaying blocks vertically in reading order:
     * **Prose block:** multiline text input + style chip (`body` | `whisper` | `emphasis`).
     * **Dialogue block:** speaker field, accent color dot, and dialogue text input.
     * **Scene Break block:** optional `label` and `timestamp`.
     * **Module block:** compact, tactile **Gimmick Pill Card** rendered exclusively from `formatCardSummary(block.props)` (title, subtitle, optional badge + module icon/layer tag). Tapping the pill opens the Schema Bottom Sheet.
   * **Per-block actions:** toggle `beatStop` (with subtle `expo-haptics` feedback), move block up/down, insert block below, delete block (with confirmation).
   * **Floating / Bottom Insert Bar:** `+ Prose`, `+ Dialogue`, `+ Scene Break`, `+ Gimmick` (opens a picker filtered strictly to the novel's `enabledModules[]`!).
   * Auto-save drafts cleanly on edit (debounced) with a subtle saved indicator.
   * Header action button: **"Preview"** (launches the Live Preview modal/screen starting at the chapter top or currently focused block).

### Deliverable D: Schema-Driven Gimmick Bottom Sheet
* Renders any module's `schema.ts` dynamically using reusable mobile-friendly controls for every field type in `packages/core/src/module-contract.ts`:
  * `text`, `multiline`, `number` (stepper / slider + numeric input respecting `min`, `max`, `step`), `toggle`, `select` (chip group), `multi-select`, `color` (preset swatches + hex input), `string-list` (add/edit/reorder/remove lines—used by `gits-cyberbrain-chat` messages), `number-list` (chip/stepper array—used by `bl-dice-3d` `scriptedNumbers`), and `asset` (local file picker / asset path stub for audio/image/model).
* Evaluates `showWhen` dynamically (e.g., `bl-dice-3d` shows `scriptedNumbers` ONLY when `outcomeMode === "scripted"`).
* Runs `schema.validate(draftProps)` live, highlights invalid fields clearly, and disables Save until valid.
* Includes a **"Reset to defaults"** action.

### Deliverable E: Live Preview Bridge (`apps/reader` ↔ `apps/writer`)
* **In `apps/reader`:** Add a tiny preview route/mode (e.g., `/preview` or `?preview=1`) that renders `readingView` using in-memory `{ novel, season, chapter, startBlockId?, tier? }` delivered over `window.postMessage` (and posts back `{ type: 'kn-preview-ready' }` once mounted). Keep it isolated and tiny so initial reader JS stays well below `40 KB` gzipped.
* **In `apps/writer`:** Add a **Live Preview Screen** wrapping `react-native-webview` (with an `<iframe>` fallback when running on Expo Web for Playwright QA):
  * Configurable Reader Preview URL setting (defaults to local dev URL, editable in app settings so the Author can point their phone at a LAN Vite server or deployed reader preview URL).
  * Sends the live unsaved `NovelManifest`, `SeasonManifest`, and `ChapterDocument` into the WebView on `kn-preview-ready` and offers a quick tier toggle (`Auto` / `High` / `Lite` / `Reduced`) and "Restart Preview" button.
  * Shows a clean, helpful offline/unreachable banner if the configured Reader URL cannot be reached.

---

## 4. Explicitly Out of Scope (Do NOT Build Yet)

* **NO `apps/publish-api`**, Cloudflare Worker, R2 uploads, or GitHub publishing (Phase 3).
* **NO new gimmick modules** beyond `core-ambient-bed`, `gits-cyberbrain-chat`, and `bl-dice-3d`.
* **NO cloud user accounts**, backend sync, or collaborative editing.
* **NO branching narratives, variables, scripting, RPG mechanics, or desktop studio layouts.**

---

## 5. Verification, Git Workflow & Required Report

1. Run full verification (via `@qa-runner`):
   * `pnpm check` (`typecheck`, `lint` with 0 warnings, all unit tests passing across `packages/core`, `packages/modules/*`, `apps/reader`, and `apps/writer`).
   * `pnpm build` (confirm `apps/reader` initial JS remains `< 40 KB` gzipped and zero `three`/`cannon-es` in initial chunks).
   * Zero-heavy-imports check confirming `apps/writer` never imports `three`, `cannon-es`, or any module's `renderer.ts`.
   * Metro / Expo bundling check (`expo export --platform web` and native bundler validation if supported in VM) with zero errors.
   * Existing `node scripts/smoke.mjs` still passes with zero regressions, **plus** a Playwright check verifying the `apps/reader` `?preview=1` `postMessage` bridge renders an unsaved draft chapter cleanly.
2. Push verified work cleanly to `origin/main`.
3. Write a concise report to `docs/qa/phase-2-pass-1-report.md` (and include it in your handoff reply) following this structure:

```markdown
# Phase 2 (Pass 1) Implementation Report

## Git & Build Verification
- Branch pushed: `main` (commit SHA: `<hash>`)
- Subagents used: summarize which tasks ran on `@builder-sonnet` vs `@qa-runner` vs main Opus session
- `pnpm check`: PASS / FAIL (test count)
- `apps/reader` `bundle-report.mjs`: paste exact gzipped sizes (confirm `< 40 KB`)
- `apps/writer` Zero-Heavy-Imports check: PASS / FAIL (how verified)
- Preview bridge & `smoke.mjs` check: PASS / FAIL

## Architecture & How Key Pieces Work
For each core subsystem (`apps/writer` SQLite/storage adapter, writer module registry, `SchemaForm` + `showWhen` engine, Chapter Editor state/auto-save, `apps/reader` preview bridge + WebView host):
- **Files & Entry Points:** exact paths
- **How It Works:** 2–4 concise bullets
- **Edge Cases Handled:** (e.g., disabled module still referenced in chapter, invalid props, `showWhen` toggling, unreachable preview URL, rapid typing auto-save)

## Known Limitations / Real-Device Notes
- Note anything that requires physical phone testing (e.g., Expo Go / dev build SQLite, iOS/Android haptics, keyboard avoiding behavior).
```

---

## 6. Required QA Screenshot Pack (Mobile Viewport `390×844`)

Capture these 6 PNGs via Playwright (against Expo Web preview of `apps/writer` + `apps/reader` preview server) into a git-ignored `qa-shots-phase2-pass1/` folder and **attach them directly in your handoff reply** (do not commit PNGs):

1. **`01-writer-bookshelf.png`** — Bookshelf showing the seeded `"Chrome Tide"` demo novel and the New Novel button.
2. **`02-writer-outline-and-modules.png`** — Book Outline / Novel Settings showing Seasons → Chapters and the `enabledModules` toggles.
3. **`03-writer-chapter-editor.png`** — Chapter Editor showing prose, dialogue, scene break, and `bl-dice-3d` / `gits-cyberbrain-chat` gimmick pill cards (rendered via `formatCardSummary`) with the bottom insert bar.
4. **`04-writer-schema-sheet-dice.png`** — Schema-driven Bottom Sheet opened on `bl-dice-3d` showing `outcomeMode: "scripted"` with `scriptedNumbers` visible via `showWhen`, material chips, and numeric steppers.
5. **`05-writer-schema-sheet-chat.png`** — Schema-driven Bottom Sheet opened on `gits-cyberbrain-chat` showing `string-list` message editor and encryption chips (`AES-Q` / `OPEN` / `SPOOFED`).
6. **`06-writer-live-preview-bridge.png`** — Live Preview screen inside `apps/writer` rendering an **unsaved edited** chapter (e.g., an edited headline or dialogue line not present in static JSON) inside the embedded `apps/reader` preview bridge.