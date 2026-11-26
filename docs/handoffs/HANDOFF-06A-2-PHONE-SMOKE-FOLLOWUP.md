# HANDOFF-06A-2 — Physical Android 15 Smoke Check & Follow-up Fixes

Follow-up to `HANDOFF-06A-ANDROID-NAV-FEEL-POLISH.md`, on the same branch
`feat/dir-06a-android-nav-feel-polish`. It records the operator's real-device check (§6 of 06A) and the two fixes
it led to. No new dependencies; `packages/core` and `apps/reader` are untouched.

## 1. Device & Build

- Device: model `23021RAAEG` (`tapas`), Android 15, USB debugging (the computer's RSA key was approved on
  first connect; adb had listed the phone as `unauthorized` until then).
- Build: `scripts/build-android-apk.ps1 -Abi arm64-v8a -Install` returned `BUILD SUCCESSFUL in 4m 35s` and wrote
  `apps/writer/dist/kinetic-writer.apk` (35.6 MB, release, arm64-v8a only, `targetSdk=36`, `versionName 0.1.0`).
  The script installed it automatically (`adb install -r` returned `Success`), and the app launched.

## 2. Operator Result (2026-11-26)

| #   | Check                                                                                  | Result                                      |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1   | Edge back-swipe (left and right) unwinds Chapter → Outline → Library, no exit          | Pass                                        |
| 2   | Appearance & Fonts / Test connection / token eye ripples clip cleanly                  | Pass                                        |
| 3   | Mid-screen swipes switch Library ↔ Notes ↔ Search; edge swipes and Recent strip do not | Pass, but **felt laggy** on the first build |
| 4   | Leaving Search closes the keyboard; Back on Notes/Search returns to Library            | Pass                                        |

After the fix in §3 and a rebuild/reinstall, the operator confirmed the tab swipe **is smooth**.

## 3. Fix — Tab Swipe Lag (`a163402`, `components/RootTabsPager.tsx`)

Two causes:

1. **The settle waited on a full re-render.** On release the pager called `setRootTab`, and the settle animation
   only started from the index `useEffect`, after React had re-rendered. `PAGES` were render functions, so that
   render rebuilt Library, Notes and Search before anything moved.
2. **The settle ignored the flick speed.** A fixed 260 ms ease-out decelerated even a fast swipe.

Changes:

- **Animate first, commit second:** `onPanResponderRelease` starts the settle on the UI thread and only then
  calls `setRootTab`. A `heading` ref records the tab a running settle is heading for, so the index effect does
  not restart it. Tab taps, Back and deep links still animate from the effect.
- **Velocity spring:** `Animated.spring` with the release velocity (`vx` dp/ms × 1000), `stiffness 320`,
  `damping 36`, `overshootClamping: true`, native driver. A fast flick lands fast and never overshoots.
- **No re-render of hidden pages:** `PAGES` are now elements created once at module scope. React reuses
  identical elements, so a tab change re-renders only the `ScreenOptions` consumers through `PageActiveContext`.
- Unchanged: the 32 dp edge zone, the `|dx| > 16 && |dx| > 1.5·|dy|` intent test, the RecentStrip yield, the
  25%/flick thresholds, Back unwinding to Library, and instant switching under Reduce Motion and on the rail.
- Limit: during the drag the finger tracking still runs on the JS thread (`PanResponder` + `setValue`). Moving
  that to the UI thread would need `react-native-gesture-handler` / Reanimated gestures, which the directive rules out.
- Verified: typecheck, ESLint (0 warnings) and Vitest (58 writer files, 691 tests) pass; `writer-shots.mjs`
  still exits 0 with **120 ✅ / 0 ❌** and 0 console errors.

## 4. Fix — APK Script on Android Studio's cmdline-tools 19 (`cadcdc1`, `scripts/build-android-apk.ps1`)

- Symptom: `ERROR: Android SDK command-line tools not found ... Re-run with -InstallTools.` even though the SDK
  was complete (platform-tools, `platforms;android-35`, `build-tools;35.0.0`).
- Cause: Android Studio installed `cmdline-tools;19.0`, whose `bin/` has no `sdkmanager.bat`. The script required
  that file unconditionally, and `-InstallTools` would have deleted Studio's `cmdline-tools\latest` to replace it
  with an older pinned copy.
- Fix: the script computes the missing SDK packages first and requires `sdkmanager` only when something is
  missing. `-ToolsOnly` now passes on this machine.

## 5. Notes for the Operator

- `react-native-reanimated` and `react-native-gesture-handler` appear in the Gradle log. They are existing
  autolinked transitive dependencies (listed in the HANDOFF-00/01 native baseline), not new: `package.json`
  and `pnpm-lock.yaml` are unchanged from `main`.
- `expo prebuild --clean` deletes `apps/writer/android/local.properties`. Running Gradle directly then needs
  `ANDROID_HOME` set; `build-android-apk.ps1` sets it for you.
