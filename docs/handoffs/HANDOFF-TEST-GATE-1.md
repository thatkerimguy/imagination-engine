# HANDOFF — TEST GATE 1 (Directives 01 + 02 on `main`, Android 16 / API 36 / 16 KB emulator)

- **Run:** 2026-11-25 · `main` @ `5f643c1` (D-02 #7) on top of `1cee5f0` (D-01 #6) · verification-only, zero source edits, nothing committed.
- **Verdict:** **12 / 13 PASS, 1 FAIL** (Settings IME clearance) + 1 cosmetic finding (3-button nav icon contrast).

## 1. Build & Artifact Verification

Build = a scratch copy of `scripts/build-android-apk.ps1` (same JDK 17 / SDK / knShortCxx / local keystore wiring), with the Gradle line swapped to
`bundleRelease assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a,x86_64`. Includes `build:preview-bundle` + `expo prebuild --clean`.
`BUILD SUCCESSFUL in 5m 54s` (665 tasks). Logs: `%TEMP%\kn-gate1-gradle.log`, `%TEMP%\kn-gate1-verify.log`.

| Artifact          | Size         | `.so` 16 KB ELF (`p_align >= 0x4000`)           | Other                                                         |
| ----------------- | ------------ | ----------------------------------------------- | ------------------------------------------------------------- |
| `app-release.aab` | **41.89 MB** | **52 pass · 0 fail** (26 arm64-v8a + 26 x86_64) | `proguard.map` **present** · native debug symbols **present** |
| `app-release.apk` | **60.79 MB** | **52 pass · 0 fail** (26 arm64-v8a + 26 x86_64) | `zipalign -c -P 16 -v 4` **PASS**                             |

`node scripts/verify-android-artifact.mjs <aab> <apk>` → `RESULT: PASS`, exit **0**.

## 2. Emulator Environment

| Item                   | Value                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Image                  | `system-images;android-36;google_apis_ps16k;x86_64` (rev 7), userdebug (`adb root` OK) |
| AVD                    | `kn_api36_16k`, `pixel_7`, 4 GB RAM, `hw.gpu.enabled=yes`                              |
| Fingerprint            | `google/sdk_gphone16k_x86_64/emu64xa16k:16/BE2A.250530.026.F3`                         |
| `getconf PAGE_SIZE`    | **16384** ✔                                                                            |
| `ro.build.version.sdk` | **36** ✔                                                                               |
| GPU                    | `-gpu auto` → host GLES/Vulkan on NVIDIA RTX 5060; WHPX hypervisor OK; boot in 115 s   |

Note: the first `sdkmanager` download hung at 59% for ~40 min; killed and re-run, then it completed.

## 3. Test Gate 1 Pass/Fail Matrix

| #   | Check                                 | Result                | Evidence                                                                                                                                                                                                                                         |
| --- | ------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | R8 cold start, zero fatal logcat      | **PASS**              | `am start -W`: `LaunchState: COLD`, TotalTime 1192 ms; 0 hits for FATAL/ClassNotFound/NoSuchMethod; crash buffer empty for the whole run                                                                                                         |
| 2   | `MaterialYou` theming                 | **PASS**              | Settings → Appearance card shows "Material You" active; native module resolved (no R8 strip); `01-cold-start.png`                                                                                                                                |
| 3   | `SaveFile` picker (R8 keep rule)      | **PASS**              | Settings → Back up now → `topResumedActivity=com.google.android.documentsui/.picker.PickActivity`; no crash                                                                                                                                      |
| 4   | Settings IME clearance                | **FAIL**              | IME inset `[0,1517][1080,2400]`; focused `publish-reader-url` at `[101,2290][979,2400]` (hidden). See §5                                                                                                                                         |
| 5   | 3-button nav edge-to-edge             | **PASS** (+ cosmetic) | Editor toolbar ends above nav bar frame `[0,2274][1080,2400]`; nav icons ~invisible (§5)                                                                                                                                                         |
| 6   | LockGate + back after Home → resume   | **PASS**              | Pinpad (`Enter PIN`) up on resume; `KEYCODE_BACK` → pinpad still shown, route beneath unchanged                                                                                                                                                  |
| 7   | Chapter Editor back-layer unwind      | **PASS**              | Find & Replace open → Back #1 closes `find-replace-bar`, stays in editor → Back #2 exits to Library (the screen it came from)                                                                                                                    |
| 8   | Conditional `FLAG_SECURE`             | **PASS**              | Recovery code: SECURE ✔ · Locked: SECURE ✔ · Hide ON + Library: SECURE ✔ · Hide OFF + Library: **cleared** (screencap OK) · Hide OFF + Master Lock: SECURE ✔. "Hide in app switcher" defaults ON                                                 |
| 9   | Live Preview load + PSS               | **PASS**              | Offline built-in reader loads (`06-preview-live.png`). Host `TOTAL PSS` **197.1 MB**; isolated renderer (`sandboxed_process0`) **109.9 MB**                                                                                                      |
| 10  | Background pause / audio hygiene      | **PASS**              | Chapter started with sound: AAudio `state:started` → Home → `state:stopped`; no crash. Resume → LockGate (Master Lock on)                                                                                                                        |
| 11  | `onRenderProcessGone` remount         | **PASS**              | `kill -9` renderer 6736 → `aw_browser_terminator: Renderer process (6736) crash detected`, `[writer] preview renderer killed (low memory); remount (1/3 in 30s, gen 1)`; new renderer 7180; host pid 3081 unchanged; preview UI back (`07-…png`) |
| 12  | Reduced Motion bridge                 | **PASS** (limited)    | All 3 animation scales set to 0 → reopened Preview, started chapter: renders, 0 errors (`08-…png`). Reader tier was not inspected (release WebView isn't debuggable). Scales restored to 1                                                       |
| 13  | `ALLOW_BACKUP` absent + `bmgr` reject | **PASS**              | `flags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]` (no ALLOW_BACKUP); `bmgr backupnow` → `Backup is not allowed`                                                                                                                                         |

Cleanup: `adb -e emu kill` → `OK: killing emulator, bye bye`; no emulator/qemu processes remain. `git status`: 0 modified tracked files.

## 4. Captured Screenshots (git-ignored `qa-shots-gate1/`)

`01-cold-start.png` · `02-savefile-picker.png` · `03-settings-ime.png` (FAIL evidence) · `03b-settings-ime-settled.png` (FAIL evidence, Author token) ·
`04-editor-3button.png` (nav-icon contrast) · `05a-recovery-secure.png` (black: FLAG_SECURE blocks screencap, as expected) · `05-unlocked-library.png` ·
`06-preview-live.png` · `07-preview-after-renderer-kill.png` · `08-preview-reduced-motion.png`

## 5. Bugs / Follow-Up Items for Directive 03

1. **FAIL — Settings: soft keyboard covers focused field (Page IME clearance).**
   Repro: Settings → scroll so PUBLISHING fields sit in the lower third → tap _Author token_ or _Public reader URL_.
   `mInputShown=true`, `InsetsSource type=ime frame=[0,1517][1080,2400]`; focused `publish-reader-url` bounds `[101,2290][979,2400]`
   (Author token try: `publish-token` `[101,2091][843,2200]`). The Settings ScrollView stays at `[0,275][1080,2400]`. It does not shrink
   or get bottom padding for the 883 px IME inset, so the field can't scroll above the keyboard. Reproduced twice, 3–4 s after focus.
   Likely area: the plain `Page` wrapper used by `settings.tsx` (no IME bottom inset / `automaticallyAdjustKeyboardInsets`) under edge-to-edge.
2. **Cosmetic — 3-button nav bar icons invisible in light theme.** With `navbar.threebutton`, the nav bar background is `#fdfdfd`
   and the back/home/recents glyphs are `#ffffff` (pixel-sampled at y=2337). Light-mode windows probably need dark nav-bar
   icons (`isAppearanceLightNavigationBars = true`). Layout clearance itself is correct.
3. **Observation — Preview tier chip ignores OS reduce-motion.** With animations off, the host still shows `Auto` selected. The reader
   gets the a11y message (`preview.tsx:100`), but the user can't see that Reduced is forced. Optional UX polish, not a bug.
4. **Observation —** `privateFlags` include `ALLOW_AUDIO_PLAYBACK_CAPTURE` (targetSdk default). If preview audio should not be capturable
   by other apps, set `android:allowAudioPlaybackCapture="false"`. Low priority.
