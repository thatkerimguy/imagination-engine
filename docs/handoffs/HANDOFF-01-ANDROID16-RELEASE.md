# HANDOFF-01 — Android 16 (API 36), Predictive Back, Edge-to-Edge & R8/AAB Release Pipeline

Date: 2026-11-25 · Executor: Claude Opus 5.5 (main session) + `qa-runner` (Haiku) · Branch: `feat/dir-01-android16-release`

## 1. Android 16 & R8 Config Verification

Source of truth: `apps/writer/app.json` (`expo-build-properties` 58.0.12 + `predictiveBackGestureEnabled` + `blockedPermissions`) and a new sibling plugin `apps/writer/plugins/with-android-release.js`. Values below were read from a fresh `expo prebuild --platform android --clean --no-install`; the permission list and back flag come from the Gradle-merged release manifest (`:app:processReleaseMainManifest`).

| File                                               | Verified value                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gradle.properties`                                | `android.compileSdkVersion=37`, `android.targetSdkVersion=36`, `android.minSdkVersion=24`, `android.enableMinifyInReleaseBuilds=true`, `android.enableShrinkResourcesInReleaseBuilds=true`, `edgeToEdgeEnabled=true`, `newArchEnabled=true`                                                                                            |
| `app/build.gradle` (`buildTypes.release`)          | `ndk { debugSymbolLevel 'SYMBOL_TABLE' }` (kn-android-release), `minifyEnabled enableMinifyInReleaseBuilds`, `shrinkResources` from the property above                                                                                                                                                                                 |
| `proguard-rules.pro`                               | `-keep class expo.modules.kotlin.records.** { *; }`; `-keep class dev.kinetic.writer.{MaterialYouModule,SaveFileModule,MaterialYouPackage} { *; }` (one line each); `-keepclassmembers class * { @com.facebook.react.bridge.ReactMethod <methods>; }`                                                                                  |
| main `AndroidManifest.xml`                         | `android:enableOnBackInvokedCallback="true"`; `tools:node="remove"` for CAMERA, RECORD_AUDIO, MANAGE_EXTERNAL_STORAGE, ACTIVITY_RECOGNITION; SYSTEM_ALERT_WINDOW no longer declared here                                                                                                                                               |
| `src/release/AndroidManifest.xml` (new, generated) | `tools:node="remove"` for SYSTEM_ALERT_WINDOW, MANAGE_EXTERNAL_STORAGE, CAMERA, RECORD_AUDIO                                                                                                                                                                                                                                           |
| `src/debug/AndroidManifest.xml`                    | SYSTEM_ALERT_WINDOW (RN dev overlay): debug only                                                                                                                                                                                                                                                                                       |
| **Merged release manifest**                        | `targetSdkVersion="36"`, `enableOnBackInvokedCallback="true"`; permissions: INTERNET, READ/WRITE_EXTERNAL_STORAGE (maxSdk 32), USE_BIOMETRIC, USE_FINGERPRINT, VIBRATE, `dev.kinetic.writer.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. **No** SYSTEM_ALERT_WINDOW, MANAGE_EXTERNAL_STORAGE, CAMERA, RECORD_AUDIO, ACTIVITY_RECOGNITION |
| `apps/writer/eas.json` (new)                       | `cli.version ">= 16.0.0"`, `appVersionSource "remote"`; `development` (developmentClient, internal, apk) · `preview` (internal, apk) · `production` (`app-bundle`, `autoIncrement: true`); `submit.production.android` = `track internal`, `releaseStatus draft` (no credentials)                                                      |

Notes:

- **Found during the audit:** the first merged release manifest also had `ACTIVITY_RECOGNITION`, pulled in by `expo-sensors` (Pedometer). The Writer only uses the accelerometer for shake, so it is now in `blockedPermissions`.
- `with-android-polish.js` was already at 249 lines, so the release hardening went into its own plugin, listed just before it. The 120 Hz MainActivity patch and the `MaterialYou` / `SaveFile` modules are unchanged and still present in the generated sources.
- NDK left at the RN 0.88.1 default (27.1.12297006), as the directive requires. The ELF results below show it already emits 16 KB segments.

## 2. 16 KB ELF Alignment Results

`scripts/verify-android-artifact.mjs` (Node built-ins only: `scripts/lib/zip-read.mjs` + `scripts/lib/elf-align.mjs`). It checks `zipalign -c -P 16 -v 4` (APK only; looks on PATH, then in the SDK build-tools the way `build-android-apk.ps1` does) and every `.so` PT_LOAD `p_align`. It skips 32-bit ABIs and, for an AAB, checks the R8 `proguard.map` and native debug symbols. Exit code 1 means a failing `.so` or a failing zipalign.

Run on the 2026-11-21 release APK (`apps/writer/dist/kinetic-writer.apk`, arm64-only build, 1218 entries):

```
zipalign 16 KB: PASS (zipalign.exe -c -P 16 -v 4 → Verification successful)
.so 16 KB ELF: 26 pass · 0 fail · 0 skip (32-bit)          RESULT: PASS
arm64-v8a, every PT_LOAD p_align = 0x4000 (3 LOADs each; libc++_shared 4):
  libappmodules libc++_shared libexpo-modules-{core,jsi,v2,worklets} libexpo-sqlite libfbjni
  libgesturehandler libgifimage libhermestooling libhermesvm libimagepipeline libjsi
  libnative-filters libnative-imagetranscoder libreact_codegen_{rngesturehandler_codegen,
  rnscreens,rnsvg,safeareacontext} libreactnative libreanimated librnscreens libstatic-webp
  libworklets libzstd-kmp
```

There is no local `.aab` yet, so the AAB `proguard.map` / debug-symbols check has not run on a real bundle (see §5). Unit tests are in `scripts/lib/elf-align.test.mjs` (6 tests, all passing). They build synthetic 64-bit ELFs: a 16 KB pass case, a 4 KB fail case, no-PT_LOAD, garbage input, truncated program headers, and a 32-bit skip. `vitest.config.ts` now also picks up `scripts/**/*.test.mjs`.

## 3. Predictive Back & Edge-to-Edge Audit

Predictive back. New pure `ui/back-layers.ts` (7 Vitest tests) and a focus-scoped `ui/use-back-intercept.ts`. Both are Android-only, because react-native-web warns on any `BackHandler` use.

- `security/LockGate.tsx` — **bug fixed:** back used to fall through to the navigator under the lock overlay, popping routes behind the PIN pad. While covered it now consumes back. The listener is registered on every (re)lock, so it runs before any screen listener. Editors also skip their layers while the Master Lock is engaged.
- `editor/ChapterEditor.tsx` — **bug fixed:** Find/Replace, the colour popover and Focus Mode are inline layers, so back skipped them and popped the chapter. Back now closes colour → Find → Focus, then pops. The route unmount and the AppState change still flush the draft (`use-chapter-draft`). Scroll-flag code moved into `editor/use-scrolled-flag.ts` to keep the file at 250 lines.
- `notes/NoteEditor.tsx` — same fix for colour popover → Find.
- `ui/Sheet.tsx`, `ui/ConfirmDialog.tsx`, `ui/PopoverMenu.tsx` — clean: RN `Modal` `onRequestClose` closes them on back.
- `editor/FindReplaceBar.tsx` — clean (closed by the editor layer above).
- `app/preview.tsx` — clean: static reader, no WebView history, back pops the route. Shake drops on blur.

Edge-to-edge:

- `ui/Sheet.tsx` — **fixed double padding:** `insets.bottom` is dropped while the keyboard is open. On Android the sheet is lifted by `computeKeyboardOffset` (handles both `adjustResize` and non-resizing edge-to-edge windows). The body is split out so only visible sheets hold keyboard listeners.
- `app/preview.tsx` — **fixed:** the reader WebView ran under the gesture / 3-button nav bar. The screen now pads `insets.bottom`. `StatusBar style="light"` has no background colour.
- Clean: `ui/TopBar.tsx` (`insets.top`), `components/FolioTabBar.tsx` (`insets.bottom`, in flow), `editor/FormattingToolbar.tsx` (`insets.bottom` dropped when the keyboard is open, plus the keyboard offset), `editor/EditorChrome.tsx` / `MetricsRibbon.tsx` / `FindReplaceBar.tsx` (under the inset TopBar), Focus Exit pill (`insets.top`).
- `ui/Page.tsx` and `app/{lock,index,settings,search,growth,doctor}.tsx` — clean: Page is a ScrollView with a 96 dp tail, which is more than a 48 dp 3-button bar. `app/_layout.tsx` uses `StatusBar style` only, with no deprecated `backgroundColor` / `translucent` and no hard-coded status-bar heights anywhere.
- `editor/InsertBar.tsx` — clean (`max(insets.bottom, xs)`). It is not mounted anywhere at the moment.

## 4. Verification Sweep (`qa-runner`)

| Gate                                                             | Result                                                                                                                                                           |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                                                     | PASS · typecheck ×3 + ESLint 0 warnings · Vitest **60 files / 708 tests** passed (was 58 / 695; includes `elf-align` + `back-layers`) · 16 s wall-clock          |
| `pnpm build` + `bundle-report.mjs`                               | PASS · "Bundle budget OK" · initial reader JS **18.7 KB gz** ≤ 20.0 · largest lazy chunk `high` 28.1 KB gz · `three.module` 132.6 KB gz (shared, excluded) · 4 s |
| `pnpm writer:export` + `writer-shots.mjs --shots qa-shots-dir01` | PASS · 33 shots · **71 ✅ / 0 ❌** · zero console/page errors · publish pack (`smoke-publish.mjs`) ✅ · 86 s                                                     |
| `git diff 0246947..HEAD -- packages/core` (+ working tree)       | empty (0 bytes)                                                                                                                                                  |

Pass 1 of the sweep failed 5 gates. The cause was the react-native-web warning "BackHandler is not supported on web" (it also broke the publish pack's zero-console gate). I fixed it by gating both `BackHandler` call sites to `Platform.OS === 'android'`, and pass 2 above is fully green. `pnpm build` was not re-run, because the fix only touched Writer sources.

## 5. Local Device / Release AAB Checklist for Operator

Run from the repo root in PowerShell, with JDK 17 and the SDK set up as `scripts/build-android-apk.ps1` does, and an Android 16 phone attached:

```powershell
pnpm android:prebuild; Push-Location apps/writer/android; .\gradlew.bat bundleRelease assembleRelease; Pop-Location
node scripts/verify-android-artifact.mjs apps/writer/android/app/build/outputs/bundle/release/app-release.aab apps/writer/android/app/build/outputs/apk/release/app-release.apk
adb install -r apps/writer/android/app/build/outputs/apk/release/app-release.apk; adb shell am force-stop dev.kinetic.writer; adb logcat -c; adb shell am start -W -n dev.kinetic.writer/.MainActivity
adb logcat -d | Select-String -Pattern "FATAL|ClassNotFound|NoSuchMethod|MaterialYou|SaveFile|ReactNoCrash"
adb shell input keyevent KEYCODE_HOME; adb shell am start -n dev.kinetic.writer/.MainActivity; adb shell input keyevent KEYCODE_BACK
```

Check by hand on the phone:

- Cold start shows the PIN pad (LockGate) and the Material You palette.
- Export → Save file opens the system picker (SaveFile, which R8 must not strip).
- On the PIN pad after background → resume, a back swipe does not reveal or pop anything.
- In a chapter, back closes Find, then Focus, then leaves. The predictive-back peek animates.

## 6. Blockers or Open Decisions

- **No AAB yet:** the AAB `proguard.map` / debug-symbols check and an R8 cold start on a device are still unverified. Run §5. The 11-21 build outputs are backed up in git-ignored `apps/writer/dist/android-outputs-2026-11-21/`, because `prebuild --clean` regenerated `android/`.
- **`eas.json` `development` profile** needs `expo-dev-client`, which is not installed. Install it before `eas build --profile development`, or drop that profile. `appVersionSource: remote` means EAS owns `versionCode` from the first cloud build.
- **Root `DIRECTIVE.md` moved** to `docs/directives/directive-02-writer-alpha.md`. `CLAUDE.md` §3/§5 and `README.md` still name a root `DIRECTIVE.md` as the active brief (generic wording, so nothing breaks). Should the Author put the next active directive there, or amend the constitution?
- Keyboard handling for plain `Page` forms (Lock PIN, Settings URL) under non-resizing Android 16 windows needs a device check. Only the editor docks and Sheets use the keyboard-offset logic.
