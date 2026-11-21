# Phase 2E — 120Hz smoothness, native shake, Material You, Folio polish

**Commits:** `47400d2` (A) · `fcb1057` (B + C) · `02c7014` (C fixes) on `main`, after `db526e1`.
`git diff 0246947..HEAD -- packages/core` is empty.

## Subagent breakdown

| Who               | Scope                                                                                                                                                                                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main (Opus 5.5)   | A1 config plugin (120Hz + MaterialYou Kotlin), A2 Material You resolver + AA guard + theme wiring + tests, A3 shake bridge (`inline.ts`, `expo-sensors`, preview), A4 `-Abi`, Phase C integration (theater theme override incl. stack header, stage-gl tier plumbing, ribbon fit, BaseReactPackage), 2E shot pass |
| Worker 1 (Sonnet) | `useSyncExternalStore` header-scroll, native-driver Toggle + SegmentControl thumb, lazy PopoverMenu modal, `keys(prefix)` cache + tests, focus-dirty `useRepoQuery`, auto-tier 1.5× GL cap                                                                                                                        |
| Worker 2 (Sonnet) | NoteEditor parity (lazy `NoteSheets.tsx`, ref-stable BlockView handlers, toolbar halves, ref-guarded scroll), ChapterEditor scroll guard, MetricsRibbon clearance                                                                                                                                                 |
| Worker 3 (Sonnet) | `CardGroup`, Settings/Backup one-pass load + cards, Match phone theme card with swatch + Soft tint / Exact wallpaper, preview theater                                                                                                                                                                             |
| qa-runner (Haiku) | Full sweep below                                                                                                                                                                                                                                                                                                  |

## Verification

| Gate                                                  | Result                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                                          | typecheck ✅ · ESLint 0 warnings ✅ · Vitest **45 files / 583 tests** ✅ (incl. `material-you`, `inline`, `cached-adapter`, `tokens`, `boundary`)                                                                                                                                                                                                                    |
| `pnpm build` + bundle report                          | reader initial JS **18.5 KB gz** (≤ 20 KB, < 40 KB budget); `three` lazy (128.5 KB gz chunk), `cannon-es` only in lazy chunks                                                                                                                                                                                                                                        |
| `expo export` web + android                           | Hermes `.hbc` **4.46 MB**; `WebGLRenderer` / `MeshPhysicalMaterial` / `cannon-es` = **0** in `.hbc` and web JS                                                                                                                                                                                                                                                       |
| `node scripts/smoke.mjs`                              | ⚠️ intermittent: 2 of 4 runs fully green (incl. 4-material dice glare, zero console errors). The 2 failures hit different timing gates under SwiftShader: sandbox tap-during-hold (result chip > 6 s) once, and context-loss recovery once (fresh context made and live, but the lease was still held 1 s after the result). Needs a follow-up look before sign-off. |
| `writer-shots.mjs --shots qa-shots-phase2e`           | all gates ✅, **zero console errors**; 5 PNGs below (+ `regression/`)                                                                                                                                                                                                                                                                                                |
| Android APK, `-Abi arm64-v8a` (Windows, local Gradle) | ✅ `BUILD SUCCESSFUL` — first build **5 m 04 s**, rebuild after the package change 6 m 44 s; **36.3 MB** release APK. `MainActivity` (120Hz mode), `MaterialYouModule.kt`, `MaterialYouPackage.kt` compile with no warnings from our code. Not yet installed on the Redmi.                                                                                           |

New 2E gates: Settings rows never move after first paint · ≥ 4 inset cards · Material You dots +
style control · ribbon's last label clear of the separator **at rest** (chapter + note editor) ·
`🎲 Tap or shake to throw` under `__KN_NATIVE_SHAKE__` · `#0E0F12` theater on a Day theme ·
a `kn-native-shake` event throws the dice.

## Shot pack (390×844, attached, not committed)

1. `01-settings-grouped-cards.png` · 2. `02-appearance-material-you-picker.png` ·
2. `03-editor-metrics-unclipped.png` · 4. `04-preview-dark-theater-shake.png` ·
3. `05-note-editor-parity.png`

## What changed

- **120Hz:** `plugins/with-android-polish.js` makes `MainActivity` request the display's highest refresh-rate mode (MIUI caps sideloaded apps at 60Hz otherwise). The scrolled flag lives in an external store, so only the top bar re-renders, and only on the 4px crossing. `onScroll` handlers are created once and ref-guarded in both editors. Toggle and SegmentControl animate on the native driver with hairline borders instead of elevation. Closed popovers and note sheets mount no `Modal`. `keys(prefix)` is cached. Screens behind the active route reload once, on refocus. The WebGL pixel ratio is capped at 1.5× on `auto` (2× only for an explicit High).
- **Shake:** `inline.ts` estimates gravity with a low-pass filter when `acceleration` is null and listens for `kn-native-shake`. The writer WebView sets `__KN_NATIVE_SHAKE__` and forwards `expo-sensors` shakes (33 ms, 1.15 g, 900 ms cooldown) only while Preview is focused and the app is active.
- **Material You:** on Android 12+ a native `MaterialYou` module reads `system_*` tonal colours. `buildMaterialYouTheme` uses them as-is (`exact`) or blends them 35 % toward Folio neutrals (`soft`), then nudges every text pair to WCAG AA (body ink ≥ 7:1). The palette is re-read on resume and falls back to Editorial Teal. `readWallpaperPalette` lives in `material-you-native.ts`, so the pure builder stays testable in node.
- **Folio UI:** Settings loads in a single `Promise.all` and renders on frame 1 inside `CardGroup` cards. The Match phone theme card has swatch dots and a Soft tint / Exact wallpaper control. Live Preview uses a fixed dark theater theme through `ThemeOverride`, covering the stack header, the tier SegmentControl and the status line. The metrics ribbon fits six metrics at rest.
- **Build:** `build-android-apk.ps1 -Abi arm64-v8a` passes `-PreactNativeArchitectures`; the default `all` keeps the universal APK.

## Flags for the Author

- On web, and on Android < 12, "Match phone theme" shows the system theme's colours; the wallpaper subtitle appears only on a real Android 12+ device.
- `expo export --platform web` and the APK script both write to `apps/writer/dist/`, and the export clears that folder. Re-copy the APK from `android/app/build/outputs/apk/release/` after an export, or rebuild.
- Closing a popover no longer fades out, because its `Modal` unmounts immediately.
