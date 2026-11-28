# HANDOFF — OVERHAUL-04A: Pre-Factory Polish, Royal Road Tables, `KnReaderWebView` Cutover, Android 16 Gate 4

Branch `feat/overhaul-04a-polish-and-gate-4` (off `main` @ `2d5dfad`, OVERHAUL-04 merged as #18). Main session (Opus 5.5)
did core contracts, the Android cutover, the release build and Gate 4. Two Sonnet workers covered `packages/engines` and
`apps/writer` in disjoint folders, and `qa-runner` ran the final web sweep. Verdict: **ready for OVERHAUL-05 with 2 open
device items**. These are the WebGL context loss on the emulator WebView (graceful), and the enriched-input last-line clip on
first mount (cosmetic, text not lost). Gate 4 also caught and fixed 2 real bugs (asset 404, DNA overwrite).

## 1. Contract updates (exact shapes)

```ts
// packages/core/src/gimmicks/template-ast.ts (new, 62 lines): tiny parser, no eval / new Function
type TemplateNode = {kind:'text';text} | {kind:'value';key} | {kind:'each';key;body} | {kind:'if';key;then;else};
parseTemplate(tpl: string): TemplateNode[]        // {{#if k}}…{{else}}…{{/if}} nests in/around {{#each}}; {{#if .}} = item
isTruthy(v): boolean                              // non-blank string | finite ≠0 number | true | non-empty array
// templates.ts: renderTemplate() now walks the AST; HTML formats → escapeHtml(values) → sanitizeStyles(out)
// security.ts
styleIssues(css: string): string[]                // allow border*, background(-color), color, padding*, margin*, width,
                                                  // max-width, font*, text-align/-transform, letter-spacing, line-height
sanitizeStyles(html: string): string              // post-render: drops any non-allowlisted / url( / expression( decl
templateTagIssues(html)                           // + now flags template CSS outside the allowlist at blueprint scan
// runtime.ts (EngineRuntimeContext)
readonly dna: ResolvedVisualDna;                  // live getter (was frozen at mount)
onDnaChange(cb: (dna: ResolvedVisualDna) => void): Unsubscribe;
// apps/reader/src/runtime/dna-bus.ts: window 'kn:dna-change' {root, dna}; dna-apply.attachDna() dispatches on every
// (re)resolve (theme flip or writer push); contexts filter on their dnaRoot. Preview control: {type:'dna', dna}.
// apps/writer/src/store/sanitize.ts (Worker 2)
type BlueprintResolver = (id: string) => GimmickBlueprint | undefined;
prepareChapter(draft, resolve: BlueprintResolver = starterResolver): PrepareResult
catalogResolver(db, chapters): Promise<BlueprintResolver>   // CatalogRepository.getMany → starters fallback
// apps/writer/src/preview/PreviewFrame.android.tsx
export const KN_ASSET_WEBVIEW_ENABLED = true;     // html (offline) → <KnReaderFrame/>; custom URL / false → RN WebView
// KnReaderFrame.tsx: requireNativeComponent('KnReaderWebView') sourcePath="index.html?preview=1";
// send() = UIManager.dispatchViewManagerCommand(tag, Commands.postMessage ?? 'postMessage', [json]);
// onKnMessage: kn-native-render-gone → recovery remount | kn-native-load-error → banner | else parseReaderMessage
```

- `system-notification.exports.royalRoadHtml` is now a pure template:
  `<table style="border-collapse:collapse;width:100%;background:#0c2340;color:#eef6ff;border:2px solid #3b82f6;margin:1em 0">`
  with `{{header}}{{#if badge}} · {{badge}}{{/if}}`, `{{title}}`, `{{#each lines}}` rows and a `{{#if footer}}` row.
  `royal-road.test.ts` asserts the exact table and that `royal-road.ts` contains no `system-notification` / `moduleId ===` branch.
- **0** `packages/modules/*` / `@kn/module-*` imports in `apps/writer/src` + `apps/reader/src` (grep = 0). The 7
  `@kn/module-*` deps are gone from `apps/writer/package.json`, and `packages/modules/` is untouched.
- `pnpm build:preview-assets` from repo root: **exit 0**, no `--no-build`. It now spawns `pnpm --filter @kn/reader build`
  (workbox-window resolves from the reader package) and restores `android/local.properties` (`sdk.dir`) after `prebuild --clean`.
- Largest touched file is **250** lines (`store/repository.ts`, `plugins/android-webview-assets.js`), and the locale files are ≤ 149.
- Deviation from CLAUDE.md §7 "frozen core": `packages/core` changed (+206/−19, 6 files), because the directive explicitly scoped A1 there.

## 2. Design decisions & trade-offs

| Topic                            | (a) Chosen                                                                                                                                                                       | (b) Rejected & why                                                                        | (c) Reversibility                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Royal Road table allow-list      | Tag allowlist (existing) + style _property_ allowlist checked twice: at blueprint scan (template CSS) and post-render (`sanitizeStyles`, catches `{{c}}` = `red;position:fixed`) | A CSS parser or DOMPurify: heavy, and the reader must stay zod/dep-free                   | One regex constant (`STYLE_PROP`)                                      |
| `{{#if}}` evaluator              | Real AST (stack parser) so `#if`/`#each` nest; unbalanced tags degrade silently                                                                                                  | Regex expansion: cannot nest, and it was already the 04 limit                             | Old grammar is a strict subset, so all 04 templates render identically |
| Fabric / interop bridge          | Legacy `SimpleViewManager` via interop; `getCommandsMap` + both `receiveCommand(String)` and `(Int)`; JS dispatches the numeric id when exposed, else the string                 | Codegen Fabric component: native codegen + a new `.so`, which breaks the 0-new-`.so` rule | `KN_ASSET_WEBVIEW_ENABLED=false` (1 line)                              |
| Renderer death / errors          | `onRenderProcessGone` returns **true** and emits `kn-native-render-gone`, so JS reuses `recovery.ts`                                                                             | Default (false), which kills the app process on a WebView crash                           | —                                                                      |
| `tactile-reveal` `touch-action`  | Inline `none` only on the live gesture button (scratch / fog / biometric) while high & unrevealed; card keeps `manipulation`                                                     | Card-level `none`, which hijacks vertical scroll over the whole card                      | Style placement only                                                   |
| `particle-field` pause           | `IntersectionObserver(0.05)`; raf runs only if visible ∧ ¬paused ∧ tier≠reduced; disconnect on destroy/abort                                                                     | rAF visibility polling (`getBoundingClientRect` per frame), which costs layout per frame  | Guarded by `typeof IntersectionObserver`                               |
| Kill switches on real Android 16 | `KN_ASSET_WEBVIEW_ENABLED = true`, `ENRICHED_SURFACE_ENABLED = true` (both stayed on)                                                                                            | —                                                                                         | —                                                                      |

Smaller calls:

- `ctx.dna` live updates are root-scoped events, not a global store, so two books in one sandbox page can't cross-talk.
- The Android build still loads `reader-preview.html` into memory (the `html` prop is the switch condition, ~1 MB read).
  Removing it is a 3-line follow-up in `use-preview-payload.ts`.

## 3. Test Gate 4 — Android 16 `kn_api36_16k` (API 36, `PAGE_SIZE=16384`)

- Release build (Sentry vars unset; `knShortCxx v4` applied to the git-ignored `android/`, same as `build-android-apk.ps1`).
  Signed with Expo's default debug keystore, because the `.keystore/` path is a blocked secret path.
  `.aab` **48.32 MB**, `.apk` **71.01 MB** (arm64-v8a + x86_64).
- `verify-android-artifact.mjs`: **RESULT PASS**. AAB 62/62 `.so` at `0x4000` (0 fail, 0 skip); APK 62/62 (0 fail).
  This covers Reanimated, Worklets, RNGH codegen, `EnrichedMarkdownTextSpec`, `libsentry*`.
- Merged manifest: `targetSdkVersion="36"` ×1, `allowBackup="false"` ×1, `fullBackupContent` + `dataExtractionRules`,
  `autoVerify="true"` ×1, `KnWriterWidgetProvider` ×1, `enableOnBackInvokedCallback` **0**.
  - Granted at runtime: INTERNET, ACCESS_NETWORK_STATE, USE_BIOMETRIC, USE_FINGERPRINT, VIBRATE, DETECT_SCREEN_CAPTURE.
    That is **0 restricted**.
  - READ/WRITE_EXTERNAL_STORAGE come from `expo-file-system` with `maxSdkVersion=32`, so they are inert on API 33+ and never granted.
- Cold start `TotalTime`: **1117 ms** on the first clean install, 741 ms on the final build. End-of-run `TOTAL PSS` **164,812 KB**.
  The logcat crash buffer stayed empty (0 FATAL) all run.

| Check                          | Result                     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G4-1 Cover `C2t`               | PASS                       | The 4200×6300 PNG went in via Photo Picker → crop. `files/covers/<id>.jpg` is 1200×1800 and `.thumb.jpg` is 240×360, both `ffd8ff`. Document Doctor was **not run**                                                                                                                                                                                                                                     |
| G4-2 Widget + landscape        | PASS                       | Typed 3 words, and `kn_writer_widget.xml` reads `3 words today`. In landscape: `mFullscreenMode=false`, no extract box, ribbon collapsed ("Show metrics"), prose visible                                                                                                                                                                                                                                |
| G4-3 Editor / tabs / back      | PARTIAL                    | Single tap gives `mInputShown=true` on the prose view. B+I round-trip is lossless (`***harbour***`, no doubled markers). Underline was not exercised (automation mis-tap). Pager Library→Notes→Search works, and edge-back from x=5 goes to Library. Backlinks, Classic Novel hiding and KeyboardAwareScrollView were **not run**                                                                       |
| G4-4 `KnReaderWebView` + Calm  | FIXED+PASS / FALLBACK (3D) | 1st run: `/reader/index.html` **404** (fixed, §4). Now logs `KnReaderWebView: loaded https://appassets.androidplatform.net/reader/index.html?preview=1` with 0 console warnings/errors apart from the WebGL line. audio-bed + KESTREL-9 render. Reduced → unclipped `[1, 1]` + "Snake eyes". 3D dice: `[stage] WebGL context lost; the spectacle finishes without drawing`, scripted result still lands |
| G4-5 tactile vs scroll + audio | PASS                       | A swipe started on the biometric card text scrolled the page 280 px. A 3.5 s hold on the scanner gave "ACCESS GRANTED", with the page static during the hold. Barroom bed crossfading, no WebAudio errors                                                                                                                                                                                               |
| G4-6 DNA + Royal Road          | FIXED+PASS                 | 1 active chip per row (Clean sans prose, Typewriter unfilled). DNA reverted on Novel-settings Save (fixed, §4). Holographic System renders chamfered corners + cobalt live. Export `.html` holds the exact `#0c2340`/`#3b82f6` table, 0 `<script>`/`<style>`, plus a clipboard toast                                                                                                                    |
| G4-7 Shutdown                  | PASS                       | `user_rotation=0`, `adb -e emu kill`. Two ~11 MB `emulator.exe` wrappers lingered and were stopped by PID; 0 remain                                                                                                                                                                                                                                                                                     |

## 4. Honest self-critique — device findings

1. **Fixed — `WebViewAssetLoader` 404.** `AssetsPathHandler` receives the path _after_ `/reader/` and opened `index.html`
   from the assets root. The handler now re-prefixes `reader/`. OVERHAUL-03 shipped this transport unverified, and this is why.
   The load-error banner path worked on the first try (no crash).
2. **Fixed — Visual DNA silently reverted.** Novel settings seeds its draft once and saved the stale `visualDna` over
   DNA Studio's write. `save()` now always takes the stored `visualDna`. Verified in SQLite: `holographic-system` survives.
3. **Added — console relay.** The view had no `WebChromeClient`, so JS errors were invisible in logcat. Warnings/errors
   now log under tag `KnReaderWebView`, plus a `loaded <url>` line.
4. **WebGL on the emulator WebView (FALLBACK).** Every 3D attempt logs a context loss (host-GPU EGL emulation; Chromium 133).
   The engine degrades as designed, but in **tap mode** the card is blank for ~holdSeconds+roll (~3 s) before the result.
   Recommend: if the context is lost before the first frame, play `playDiceLite` instead of waiting. Calm-Mode _teardown_ of a
   live WebGL roll is therefore still unproven on Android.
5. **Enriched input clips its last wrapped line on first mount** (8-line serif paragraph, node 483 px tall). It appears
   while focused too, and the text stays intact in the model. Any formatting reflow re-measures it correctly. This is native
   measure-vs-render drift in `react-native-enriched-markdown`, so I did not trip `ENRICHED_SURFACE_ENABLED`.
6. The formatting toolbar sits flush on the gesture-nav strip, and taps at its lower edge (y≈2337/2400) are swallowed.
   It works at y≈2312. Worth +8 dp bottom inset.
7. Gboard's first focus shows a "Try out your stylus" sheet that eats typing (emulator Gboard; not app-caused).
8. Emulator audio runs with `-no-audio`: beds report "crossfade" after unlock, but nothing is audible, so sound feel is unverified.
9. Test-data side effects in the emulator book: an extra Barroom bed, and a tab char where "long" was. Both came from automation
   mis-taps; there is no repo impact.

## 5. Cohesion & UX

- Classic → Interactive → Catalog → DNA Studio → Live Preview → Royal Road now flows without a raw ID in sight.
  - Catalog rows and the editor `CuePill` show "Ambient Sound / Chat Thread / 3D Object" (en/tr/es).
  - Only PRO items carry a pill.
  - The cue sheet has a full-width 48 dp Done.
- The 4 OVERHAUL-04 rough spots, verified on device:
  1. Audio pills use SVGs (cloud-rain, users), with a gap fixed after Gate 4.
  2. `[1, 1]` stays unbroken, with "Snake eyes" on its own line.
  3. ember-storm light mode is code- and test-verified only (`#b23a0e`, +0.5 px), not shot.
  4. spatial-layout `" / "` is gone (unit test).
- Remaining seam: the DNA Studio "Save" stays on screen with no confirmation toast, and Novel settings is a second Save.
  Consider making Novel settings save-on-leave or showing DNA's own saved state.

## 6. Web / CI metrics & visual evidence (`qa-shots-overhaul04a/`)

- `pnpm check`: **PASS**. tsc for root/writer/publish-api; ESLint 0 warnings; Vitest **134/134 files, 1325/1325 tests**
  (incl. `template-if.test.ts` 9, `royal-road.test.ts`, `blueprint-resolver.test.ts`, `dna-choice.test.ts`, `dna-bus.test.ts`, i18n parity).
- `pnpm build`: **PASS**. Reader initial JS **11.3 KB gz** (target 16.0, cap 20.0; brief cap 13.0 ✓). zod: none.
  three/cannon (`dice-mesh` 133.8 KB gz, `high` 25.3 KB gz) imported only by `bespoke-3d`.
- `node scripts/smoke.mjs` and `writer-shots.mjs --shots qa-shots-overhaul04a`: **NOT RUN**. Playwright is not installed in
  this environment ("Cannot find module 'playwright'"), and I did not install it without approval. `pnpm writer:export` passed.
  So the 42/42 smoke matrix and the phone/tablet/smoke-publish shot gates are **unverified this pass**. The 5 PNGs below are
  device captures from Gate 4, not Playwright shots.

| PNG                                       | Scrutinize                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `01-engine-polish-audio-svg-and-dice.png` | Feather cloud-rain glyph spaced from "Rain"; `[1, 1]` not split, caption on line 2         |
| `02-catalog-and-form-polish.png`          | "3D Object / Ambient Sound / Sound Cue" labels, PRO only on CRT Scanlines; full-width Done |
| `03-dna-studio-chip-fix.png`              | Prose font: only Clean sans filled, Typewriter clean right after the tap                   |
| `04-gate4-android-preview-and-calm.png`   | Same viewport High vs Reduced on Android 16; identical unclipped result card               |
| `05-gate4-android-dna-preview.png`        | Holographic chamfers + cobalt KESTREL-9; landscape editor with collapsed ribbon            |

## 7. Readiness sign-off & open calls for OVERHAUL-05

Ready to start the factory. The template grammar (`{{#if}}`), the style allowlist and live DNA are the contracts the 100–1,000
blueprints will lean on, and they are now locked and tested. Three calls first:

1. **Ed25519 pack signing.** Decide key custody (offline key + public key baked into writer and reader) and rotation before
   R2 packs. `catalogResolver` already inlines any `CatalogRepository` blueprint, so an unsigned pack would reach exports.
2. **Factory taxonomy.** Confirm the genre/subgenre list and the per-engine quota for the first 100. Today 28 starters are
   heavy on LitRPG/Cyberpunk/Thriller; the cue-picker chips scale horizontally but need a "More" overflow past ~8 genres.
3. **bespoke-3d no-WebGL path.** Approve "context lost before first frame → lite dice". Factory 3D blueprints would otherwise
   show a blank card on WebGL-less devices.

Not done here: Document Doctor (G4-1), Backlinks / Classic-Novel / KeyboardAwareScrollView (G4-3), live-3D Calm teardown
on device, and an ember-storm light screenshot.
