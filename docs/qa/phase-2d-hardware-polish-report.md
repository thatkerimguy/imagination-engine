# Phase 2D — Real-device polish, built-in offline preview, local Android APK

Directive 02D, following the first physical Android test (sound, SQLite, keyboard docking and
Live Preview all passed; 6 hardware issues + stricter QA + a local Gradle APK requested).

**Commits:** `92c0d68` (A) · `c685f5a` (A, prefs) · `5ab8210` (B) · `7c5b9bf` (C fixes) · this
report. `git diff 0246947..HEAD -- packages/core` is **empty**.

## Subagent breakdown

| Agent                 | Scope                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Main (Opus 5.5)       | A1 dice glare, A2 offline bundle pipeline, A3 read cache + header hoist, A4 APK script, prefs fields, Phase C integration and Windows fixes    |
| Worker 1 (Sonnet 5.5) | Collapsible toolbar halves, lazy sheet mounting, memoised blocks, idle-quiet live metrics, `toolbar-collapse.test.ts`, `perf.test.ts`          |
| Worker 2 (Sonnet 5.5) | Offline WebView / `srcDoc` preview host, `PreviewBanner`, Live preview + Haptics settings, `hapticTestSequence()`                              |
| Worker 3 (Sonnet 5.5) | Search excerpt drift + locked-ancestor redaction, `.knbook` label, `repository-cache.test.ts`, dice glare / offline preview / toolbar QA gates |
| qa-runner (Haiku 5.5) | Single full verification sweep (below)                                                                                                         |

## Verification (qa-runner sweep)

| Gate                                | Result                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                        | ✅ typecheck (root + writer), ESLint 0 warnings, **548 tests / 42 files** (was 533 / 39)                            |
| `pnpm build` + `bundle-report.mjs`  | ✅ initial reader JS **18.5 KB** gz (6.1 + 12.4) / 40 KB budget; three.js only in `lazy/three.module` (128.5 KB)    |
| `pnpm build:preview-bundle`         | ✅ `reader-preview.html` **710.1 KB** raw / **189.4 KB** gz, zero external references                               |
| `expo export --platform android`    | ✅ Hermes `entry-*.hbc` **4.22 MB**; `WebGLRenderer` / `cannon-es` / `ContactMaterial` / `MeshPhysicalMaterial` = 0 |
| HTML as asset                       | ✅ shipped as a separate hashed asset (727,114 bytes), never in the `.hbc`                                          |
| `expo export --platform web`        | ✅ no three / cannon / MeshPhysicalMaterial in any web JS chunk                                                     |
| `node scripts/smoke.mjs`            | ✅ all passes incl. the new 4-material glare gate, zero console errors                                              |
| `node scripts/writer-shots.mjs`     | ✅ offline preview with no reader server, toolbar halves, settings, compiler; zero console errors                   |
| `apps/writer/src` files > 250 lines | none; zero `any`                                                                                                    |

The `.hbc` contains the string `__KN_OFFLINE_PREVIEW__` once: it is the loader's integrity check
(`offline-reader.ts`), not reader code.

## A1 — Dice glare (all 4 finishes)

`palette.ts` now carries `clearcoatRoughness` + `envMapIntensity` per finish (values exactly as
directed), `dice-mesh.ts` wires them into `MeshPhysicalMaterial`, and `high.ts` uses a softer
PMREM (`fromScene(room, 0.10)`), key light at `(-7.5, 8.5, 10)` × 1.55, ambient 0.36.

Measured on settled scripted `[6, 6]` throws, High tier (die pixels = differ from a pre-throw
baseline; spread = p95 − p5 luminance):

| Material   | mean RGB    | median RGB  | mean lum | stddev | spread | near-white |
| ---------- | ----------- | ----------- | -------- | ------ | ------ | ---------- |
| Ivory      | 205,203,198 | 226,224,220 | 202.9    | 39.5   | 130.1  | 0.00%      |
| Casino Red | 184,94,102  | 187,85,90   | 113.9    | 53.2   | 189.5  | 0.00%      |
| Brass      | 210,186,119 | 229,206,129 | 186.1    | 43.5   | 121.8  | 0.51%      |
| Obsidian   | 136,133,126 | 114,114,113 | 132.8    | 47.7   | 143.7  | 0.03%      |

Casino red passes the crimson gate (median R > G + 45 and R > B + 45) and the blow-out gate
(mean luminance < 225). Gate thresholds (die mask diff ≥ 120, stddev ≥ 8, spread ≥ 60) were set
before calibration and all materials clear them comfortably.

## A2 — Built-in offline preview

- `apps/reader/vite.preview.config.ts` + `apps/reader/offline-preview/index.html` +
  `src/offline-preview.ts` build the `?preview=1` reader with `codeSplitting: false`;
  `scripts/build-preview-bundle.mjs` inlines JS + CSS into one HTML file and refuses to write
  one with external references. `app.ts` delta: 38 bytes (`'__KN_OFFLINE_PREVIEW__' in window`).
- **Generated, git-ignored.** `writer`, `writer:web`, `writer:export`, `export:android`,
  `android:prebuild` and the APK script rebuild it first (`--if-stale` compares mtimes against
  reader / core / module sources). Documented in `README.md`.
- Metro: `'html'` added to `resolver.assetExts`. Native loads it with `expo-asset` +
  `expo-file-system` `File.text()`; web fetches the exported asset and uses `iframe srcDoc`.
- `previewMode: 'offline' | 'custom-url'` (default offline). Offline caption reads
  "Live · Built-in offline reader · draft"; custom-URL failures offer "Switch to Built-in
  Offline Reader".
- Verified with every non-local request aborted: the edited unsaved line renders, dice settle,
  zero requests, zero console errors.

## A3 — Navigation lag

- `_layout.tsx`: hoisted `renderHeader`.
- `CachedAdapter` (`store/cached-adapter.ts`) wraps the repository's adapter: read-through
  `Map<string, string | null>`, updated in the same step as every write/remove (invalidated if
  the write throws). Backups/restores already go through it; Document Doctor (own adapter)
  calls `repo.clearCache()` after repairs.

## A4 — Local Android APK

- `.gitignore`: `apps/writer/android/`, `dist/`, `dist-android/`, `.keystore/`, the preview HTML.
- `app.json`: `versionCode: 1`, `USE_BIOMETRIC` + `VIBRATE`, plugins `expo-local-authentication`
  and `expo-image-picker` (camera + microphone permissions dropped).
- `scripts/build-android-apk.ps1` (`pnpm android:apk`): JDK 17 discovery/installation (winget
  Temurin), Android command-line tools + `platform-tools`, `platforms;android-35`,
  `build-tools;35.0.0` with licenses, preview bundle, `expo prebuild --clean`, local PKCS12
  keystore + release signing appended to `app/build.gradle`, `gradlew assembleRelease`, copy to
  `apps/writer/dist/kinetic-writer.apk`, `adb install -r`. Switches: `-InstallTools`,
  `-Install`, `-Variant debug|release`, `-SkipPrebuild`, `-ToolsOnly`, `-WithAndroidStudio`.
  The command-line tools are installed instead of Android Studio by default, because Studio
  only yields an SDK after its interactive first-run wizard.
- **Status on the Author's machine:** JDK 25/27 and adb were present, JDK 17 and the SDK were
  not. `-InstallTools -ToolsOnly` started the Temurin 17 winget install, which was waiting for
  a Windows elevation (UAC) prompt when this report was written, so the APK build itself had
  not run yet. Once JDK 17 is in place:

  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/build-android-apk.ps1 -InstallTools -Install
  ```

## Phase B highlights

- Toolbar halves collapse to one 44dp arrow each (`toolbar-collapse-*` / `toolbar-expand-*`),
  persisted in `prefs/writer-ui`, `focusable={false}`; survive reload (E2E).
- `EditorSheets` mounts only the open sheet (closing now skips the Modal fade-out).
- `BlockView` is `memo`; `ChapterEditor` passes ref-backed stable handlers.
- Live metrics: no interval; one 5.5 s decay timeout while `typingCpm > 0`, then fully quiet.
- Search: excerpt highlight no longer drifts on leading whitespace; notes under a locked parent
  or grandparent are redacted (cycle-safe).
- Haptics: `hapticsEnabled` respected app-wide (synced at startup), `hapticTestSequence()`.

## Integration notes and flags

- **Windows fixes** to existing QA scripts: `bundle-report.mjs` used `URL.pathname` (broken
  paths on Windows); `smoke.mjs` spawns pnpm through a shell and tree-kills it on Windows.
  Playwright was installed globally; run the scripts with `NODE_PATH` set to `npm root -g`.
- A Phase B source file contained literal U+FFFD characters in the preview caption; fixed, and
  the E2E now asserts the exact `Live · Built-in offline reader · ` prefix.
- The Author's working tree had an uncommitted Expo CLI rewrite of `apps/writer/tsconfig.json`
  (and a deleted `expo-env.d.ts`) that made `Press.tsx` fail `tsc`; those files were left
  untouched and `Press.tsx` now typechecks under either config.
- `expo-asset` was added to the writer via the lockfile + `pnpm install --frozen-lockfile`
  (passes the pnpm supply-chain policy check) because `pnpm add` re-resolution was blocked.

## QA pack (390×844, attached to the handoff, `qa-shots-phase2d/`)

1. `01-dice-4-materials-glare-check.png`
2. `02-toolbar-halves-collapsed.png`
3. `03-offline-live-preview-no-server.png`
4. `04-settings-offline-and-haptics.png`
5. `05-compiler-knbook-fixed.png`
