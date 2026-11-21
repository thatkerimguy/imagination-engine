# Phase 2F — Keyboard/navbar dock, File Picker exports, smoke stability, code-health audit

**Commits:** `44eaa04` (A) · `21facf0` (B + C) · `b5e0562` (smoke harness), plus this report, on
`claude/new-session-hmmi18`, after `922184b`. `git diff 0246947..HEAD -- packages/core` is empty.

## Subagent breakdown

| Who               | Scope                                                                                                                                                                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main (Opus 5.5)   | A1 `SaveFileModule.kt` + `save-file-native.ts` + chunk-safe `base64.ts`, A2 `dist-web/`, A3 smoke race fixes + real-time dice fade, A4 `useKeyboardDock` + tests; Phase C integration, web a11y state, dead-export sweep, Kotlin prebuild check, smoke harness lifecycle fix |
| Worker 1 (Sonnet) | Toolbar dock (minHeight, nav-bar inset, keyboard offset), optimistic 180 ms SegmentControl/Toggle, unclipped UnderlineTabs, memoized ribbon/toolbar/inline runs, empty-note cleanup, `controls.test.ts`                                                                      |
| Worker 2 (Sonnet) | `deliverText`/`deliverBytes`/`deliverBase64` through the File Picker, PDF via picker, honest saved/cancelled status at every call site, import audit, `deliver.test.ts`                                                                                                      |
| Worker 3 (Sonnet) | Calm Search (no autofocus, deferred index), deferred RecentStrip, 3-at-a-time font preview queue, 100-block bench, `writer-shots-2f.mjs` gates                                                                                                                               |
| qa-runner (Haiku) | Full sweep below (smoke ×3 re-run by Main after the harness fix — see Stability)                                                                                                                                                                                             |

## Verification

| Gate                                           | Result                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                                   | typecheck ✅ · ESLint 0 warnings ✅ · Vitest **50 files / 613 tests** ✅ (new: `use-keyboard-dock`, `base64`, `controls`, `deliver`, `editor-bench`)                                                                                                                                                                                                                                          |
| `pnpm build` + bundle report                   | reader initial JS **18.5 KB gz** (≤ 20 KB, < 40 KB budget); `three` lazy (132.6 KB gz chunk); `cannon-es` only in lazy chunks                                                                                                                                                                                                                                                                 |
| `expo export` web                              | output in `apps/writer/dist-web/`; `apps/writer/dist/kinetic-writer.apk` untouched (same mtime before/after)                                                                                                                                                                                                                                                                                  |
| `expo export` android                          | Hermes `.hbc` **4.29 MiB**; `WebGLRenderer` / `MeshPhysicalMaterial` / `cannon-es` = **0** in `.hbc` and every web JS chunk                                                                                                                                                                                                                                                                   |
| 100-block (~4,500-word) bench, median of 5     | `analyzeDocument` **6.6 ms** · `inlineRuns` over all blocks **1.0 ms** · `buildSearchIndex` **1.5 ms** (ceiling 50 ms each)                                                                                                                                                                                                                                                                   |
| Kotlin prebuild (`expo prebuild --no-install`) | `MainActivity.kt` (120Hz block), `MaterialYouModule.kt`, `MaterialYouPackage.kt` (registers both modules), `SaveFileModule.kt` generated under `dev.kinetic.writer`; all three module files **compile with kotlinc 2.1.0** against signature stubs taken from RN 0.88's `ActivityEventListener` / `Promise` / `BaseReactPackage` / `ReactModuleInfo`. `android/` deleted. Not a Gradle build. |
| `writer-shots.mjs --shots qa-shots-phase2f`    | **51 ✅, 0 ❌**, zero console errors; 4 PNGs below (+ `regression/`, now including the five 2E shots)                                                                                                                                                                                                                                                                                         |
| `node scripts/smoke.mjs` ×3                    | **3/3 PASS** back to back (exit 0, zero ❌, zero console errors). Tap during hold → handoff in 29 / 28 / 29 ms; context loss → `GL contexts made 2 · leases 0` every run                                                                                                                                                                                                                      |

New 2F gates: Search does not take focus · Search / Text Analysis / Growth tabs fit their boxes and
`Notes` is whole · toolbar ≥ 44 px and both collapse halves work in chapter + note editor, zero
console output · Settings and Appearance segments switch in place with zero console warnings.

## Stability (smoke)

Phase 2E's two flakes had separate causes:

- **Tap during hold > 6 s:** `holdOrTap` registers its tap listener one frame after the dice settle; under SwiftShader the test could click before that frame. The test now waits two frames after settling. Result: the tap hands off in 13–28 ms.
- **Lease still held 1 s after the result:** not a leak. The fade advanced with the roll's 1/20 s per-frame clamp, so at a few fps on a software GPU the 0.45 s fade (and the lease release at its end) stretched past 1 s. The fade now runs on real time (capped at 0.25 s a frame) in `bl-dice-3d/high.ts`; the test polls for `leases 0` instead of sleeping.

The first qa-runner sweep then hit a harness problem, not a reader one: `browser.close()` can wedge
under SwiftShader after every gate has passed, and an interrupted run left its preview server
behind (`server.kill()` only signalled the `pnpm` wrapper, not vite). The next run then talked to
that orphan until it died (`ERR_CONNECTION_REFUSED` on :4173). `scripts/smoke-server.mjs` now
refuses to start if :4173 already answers, runs the server in its own process group and kills the
group on exit / Ctrl+C / timeout; `smoke.mjs` bounds `browser.close()` at 10 s and exits explicitly.

## Shot pack (390×844, attached, not committed)

1. `01-search-calm-unclipped-notes.png` · 2. `02-editor-toolbar-docked-safe.png` ·
2. `03-settings-smooth-controls.png` · 4. `04-appearance-staggered-fonts.png`

## What changed

- **File Picker exports:** on Android every export (`.docx`, `.pdf`, `.md`, `.html`, `.txt`, `.knbook`, backup `.zip`, novel/chapter `.json`) opens the system "Save file" picker through the new `SaveFile` module; in Expo Go it falls back to the SAF folder picker, never the share sheet. iOS keeps the share sheet (its "Save to Files" is the system picker). A dismissed picker resolves `'cancelled'` and the UI stays quiet; a save shows `Saved <file>` / `Backup saved.`; only real IO errors show an error. PDFs are printed to cache, passed through as base64 and the cache file is deleted. Base64 is encoded in 24 KB chunks (3 MB round-trip tested).
- **Imports:** `.txt/.md/.docx` import and `.zip/.knbook` restore already used `*/*`; the extension is now checked before reading, with a clear error. The font picker used a narrow MIME list that Android Files greys out for many `.ttf/.otf`; it is now `*/*` (extension + magic bytes are still validated).
- **Keyboard/navbar dock:** `KeyboardAvoidingView` is gone from both editors. `useKeyboardDock` measures the root and lifts the toolbar only by the part of the keyboard the OS did not already absorb (edge-to-edge overlay → full height, `adjustResize` → 0). With the keyboard closed the toolbar pads `insets.bottom`, so it clears the gesture pill / 3-button bar.
- **Smooth controls:** SegmentControl and Toggle move their thumb on frame 0 from an optimistic value (180 ms, ease-out cubic, native driver), then hand the change to `startTransition`. Equal-width `onLayout` no longer restarts the slide. On web the native driver is off (it only warned), and tabs/segments/toggles now expose `aria-selected` / `aria-checked` (react-native-web 0.21 ignores `accessibilityState`).
- **Tabs:** UnderlineTabs labels keep one weight (600) in both states, `flexShrink: 0`, 14 px side padding, `includeFontPadding: false`; a row that cannot fit scrolls instead of shrinking.
- **Editor perf:** `inlineRuns` is memoized; MetricsRibbon and FormattingToolbar are `React.memo` with stable handlers.
- **Empty notes:** a note that opens empty and is left empty (blank title, no text) is deleted after its last save flushes.
- **Calm tabs:** Search no longer autofocuses and builds its index after the transition frame; RecentStrip refreshes after it; Appearance loads font previews 3 at a time. React Native 0.88 no longer ships `InteractionManager`, so `ui/after-interactions.ts` provides a small rAF + 60 ms stand-in.
- **Build:** `pnpm writer:export` writes `apps/writer/dist-web/` (git-, ESLint- and Prettier-ignored), so the APK in `apps/writer/dist/` survives.

## Code-health sweep

- Removed 9 unreferenced exports: `toolFace`, `HeaderScrollProvider`, `HAIRLINE`, `usePrefsReady`, `proseFont`, `saveManualOrder`, `exportChapterArchive`, `PIN_LENGTHS` (writer) and `onPrefsChange` + its listener set (reader). No dead files.
- `auto-backup.ts` imported `./snapshots.ts` explicitly, so Metro bundled the native snapshot writer on web (it warned `expo-file-system is not supported on web` and threw in auto-backup). It now imports `./snapshots`, which resolves `snapshots.web.ts`.
- Zero `any`, zero `console.log`, zero files > 250 lines in `apps/writer/src`, zero Material 3 remnants.

## Flags for the Author

- Not yet tried on the Redmi: the keyboard dock (both Android modes), the Save-file picker, Android tab rendering and the 120Hz feel of the controls. Worth a pass with the next APK.
- Tab labels are now semibold in both states (the active tab is ink + underline, inactive is muted). That is what makes truncation impossible; say if you prefer regular-weight inactive labels and I'll reserve the width another way.
- A note is deleted only if it was empty when opened and is still empty on exit. A note you empty on purpose is kept.
- Web PDF export still opens the browser's print dialog (no saved/cancelled signal), so it shows no confirmation.
