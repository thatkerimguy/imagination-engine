# HANDOFF-02 — Runtime Resilience, Background Lifecycle, AutoBackup & Screen Privacy

Branch `feat/dir-02-runtime-privacy`, cut from `main` @ `1cee5f0` (which includes DIRECTIVE-01). `packages/core` is untouched.
Opus did the protocol and all Writer work. One `builder-sonnet` worker did `apps/reader` and three modules. `qa-runner` ran the sweep.

## 1. WebView Recovery, Lifecycle Bridge & Module Pause

- **Crash recovery** (`preview/PreviewFrame.tsx` + pure `preview/recovery.ts`, 5 tests):
  - Android `onRenderProcessGone` and iOS `onContentProcessDidTerminate` unmount the WebView, then remount it 250 ms later with a new `key`.
  - Budget: at most **3 recoveries per 30 s**. The 4th crash shows a Folio `EmptyState`, "The preview stopped", with a **Reload preview** button that resets the budget.
  - Telemetry logs only counts, the window and the generation (`[writer] preview renderer killed (low memory); remount (1/3 in 30s, gen 1)`). It never logs prose or titles.
  - **Replay:** a remounted page posts `kn-preview-ready`. `app/preview.tsx` then resends a11y, lifecycle and the chapter at the selected tier, starting at the last reported block.
  - This needed one new reader → host message, `{type:'kn-preview-position', blockId}`, sent on each segment change in preview mode.
- **Security audit:** `PreviewFrame.tsx` sets `allowFileAccess`, `allowFileAccessFromFileURLs`, `allowUniversalAccessFromFileURLs` and `setSupportMultipleWindows` to `false`; `originWhitelist` narrowed from `['*']` to `['https://*','http://*','about:*']`. No SSL-error overrides in `plugins/` or `src/`; `PreviewFrame.web.tsx` unchanged.
- **Protocol** (both `protocol.ts` files, tests in both): host → reader `{type:'lifecycle', state:'active'|'background'}` and `{type:'a11y', reducedMotion}`. The reader parses them with `parseHostControl()`, which rejects malformed input.
- **Host wiring:** new `preview/use-host-signals.ts`: `useForeground()` (screen focus AND `AppState === 'active'`) and `useReduceMotion()` (`AccessibilityInfo.isReduceMotionEnabled()` + `reduceMotionChanged`). `app/preview.tsx` sends both on change and on every `ready`; `use-native-shake.ts` reuses `useForeground()`.
- **Host audit:** accelerometer subscribed only while focused, foreground and live; `store/autosave.ts` has one debounced 600 ms timer, flushed on background by the draft hooks; `backup/auto-backup.ts` runs once at repo open, no timers; no wake-lock API anywhere.
- **Reader:**
  - `runtime/lifecycle.ts` dispatches `CustomEvent('kn:lifecycle', {detail:{active}})`.
  - `audio-bus.ts` suspends the `AudioContext` on `hidden`, on `pagehide` and when lifecycle is background. It resumes only when the page is visible, lifecycle is active, sound is on and the bus is unlocked. Every suspend and resume call has `.catch()`.
  - The shared `stage-gl.ts` RAF loop stops when hidden or backgrounded and restarts when it resumes.
  - Host `reducedMotion: true` is ORed with `prefers-reduced-motion`, so any tier resolves to `reduced`. A change remounts the chapter at the last block.
- **Modules:**
  - `bl-lighter-flick`, `gits-ghost-whisper` and `bl-dice-3d` each have a `pause-gate.ts` plus 3 tests. The three copies are identical because modules cannot share code.
  - The gate covers RAF loops (lighter canvas, dice lite) and `deviceorientation`/`devicemotion` handling. Ghost-whisper also resets tilt when it pauses.
  - Everything is torn down by the AbortSignal. The dice high tier rides the stage-gl loop.
- **WCAG 2.3.1:** all 6 modules pass and none were changed. Lighter flicker is at most about 4 Hz with ±10 % amplitude. Cyberbrain jitter is about 1.2 changes/s on small elements and does not run on reduced. Every reduced tier is static.

## 2. AutoBackup XML & Conditional `FLAG_SECURE`

- New `plugins/android-backup-rules.js` (93 lines), wired from `with-android-release.js`. `app.json` sets `android.allowBackup: false`.
- Storage locations confirmed:
  - The single SQLite DB is `filesDir/SQLite/kinetic-writer.db` (expo-sqlite). It also holds the Master Lock hashes; there is no SecureStore.
  - Snapshots live in `filesDir/backups`.
- `npx expo prebuild --platform android --clean --no-install` generated both rule files:
  - `res/xml/data_extraction_rules.xml`, with `<cloud-backup>` and `<device-transfer>` sections.
  - `res/xml/backup_rules.xml` (`<full-backup-content>`).
- Both files exclude `file:SQLite`, `kinetic-writer.db` and its `-wal`/`-shm`, `file:backups`, `database:.` and `sharedpref:.`.
- **Merged release manifest:**
  - Checked with `gradlew :app:processReleaseMainManifest`, with `ANDROID_HOME` set to `%LOCALAPPDATA%\Android\Sdk`.
  - Result: `allowBackup="false"`, `fullBackupContent="@xml/backup_rules"`, `dataExtractionRules="@xml/data_extraction_rules"`, with no merger conflict.
  - The source manifest carries `tools:replace` for these three attributes.
- **`expo-screen-capture` 58.0.6.** It was installed with `expo install`; Expo and RN are unchanged.
- **`shouldBlockScreenCapture`** returns `isLocked || onSensitiveScreen || (lockEnabled && hideInRecents)`.
  - `hideInRecentsSetting(config)` is `false` when Master Lock is off. Otherwise it is `config.hideInRecents ?? true`, stored in `LockConfig`.
  - The predicate and setting have 3 tests in `screen-privacy.test.ts`.
- **Wiring:**
  - `useScreenPrivacy(tag, active)` gives each hook instance a unique key (`useId`), and the library reference-counts the keys. Unmounting a child therefore never drops `LockGate`'s hold.
  - `LockGate` applies the predicate.
  - `app/lock.tsx`, `PinPad`, `NewPinFlow` and `RecoveryCodeCard` are always protected.
  - On web, `capture.web.ts` is a no-op.
- **UI:** `LockHome` shows a Folio `Toggle` row, "Hide in app switcher" with the Feather `eye-off` icon. It appears only while Master Lock is on.

## 3. Carry-Over Fixes

- **`ui/Page.tsx`** (202 lines):
  - On Android, while the IME is open, the content gets `paddingBottom = max(96, keyboardOffset + 24)`.
  - It reuses `useKeyboardDock` / `computeKeyboardOffset`. That offset already subtracts any `adjustResize` shrink, and `insets.bottom` is not added, so nothing is padded twice.
  - Caller `onLayout` is chained. Editor layouts don't use `Page` and are unaffected.
- **Docs:**
  - `CLAUDE.md` §3 tree now lists `docs/directives/` and `docs/handoffs/`. §5 now says "the active directive brief (attached to the session; archived under `docs/directives/`)". It is **114 lines**.
  - `README.md` intro was updated the same way.

## 4. Verification Sweep (`@qa-runner`)

| Gate                                                             | Result                                                                                                                                               |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                                                     | PASS · typecheck ×3 · ESLint 0 warnings · **65 files / 730 tests** · 16 s                                                                            |
| `pnpm build` + bundle-report                                     | PASS · initial reader JS **18.9 KB gz** (main 6.2 + module-host 12.7) · three 128.5 KB (shared) · largest module chunk `high` 27.2 KB · all < 300 KB |
| `node scripts/smoke.mjs` (incl. pack-1, preview bridge)          | PASS · ×20 **No leaks** for dice and pt-gaslight / ghost-whisper / lighter on high, lite and reduced · 0 console errors · 407 s                      |
| `pnpm writer:export` + `writer-shots.mjs --shots qa-shots-dir02` | PASS · **71 ✅ / 0 ❌** · zero console/page errors                                                                                                   |
| `git diff 0246947..HEAD -- packages/core` (+ working tree)       | empty                                                                                                                                                |
| Line counts                                                      | every touched source file ≤ 250 lines (largest `app/preview.tsx` 241)                                                                                |

- First shots pass was 69/71: an explicit `./capture.ts` import bypassed Metro's `.web.ts` resolution (web warned `ScreenCapture … not available on web`); `./capture` fixed it → 71/0. Smoke/shots need `NODE_PATH="$(npm root -g)"` (global Playwright).

## 5. Unified Test Gate 1 Checklist for Operator (Directive 01 + 02)

Run from the repo root in PowerShell, with JDK 17, `$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"`, and an Android 16 phone with USB debugging:

```powershell
pnpm build:preview-bundle; pnpm android:prebuild; Push-Location apps/writer/android; .\gradlew.bat bundleRelease assembleRelease; Pop-Location
node scripts/verify-android-artifact.mjs apps/writer/android/app/build/outputs/bundle/release/app-release.aab apps/writer/android/app/build/outputs/apk/release/app-release.apk
adb install -r apps/writer/android/app/build/outputs/apk/release/app-release.apk; adb shell am force-stop dev.kinetic.writer; adb logcat -c; adb shell am start -W -n dev.kinetic.writer/.MainActivity
adb logcat -d | Select-String -Pattern "FATAL|ClassNotFound|NoSuchMethod|MaterialYou|SaveFile|ScreenCapture|preview renderer"
adb shell input keyevent KEYCODE_HOME; adb shell am start -n dev.kinetic.writer/.MainActivity; adb shell input keyevent KEYCODE_BACK
```

1. **Artifact:** `verify-android-artifact` exits 0. The AAB has `proguard.map` and native symbols, and every 64-bit `.so` has 16 KB `p_align`.
2. **R8 cold start:**
   - The PIN pad appears (LockGate).
   - The Material You palette is applied.
   - Export → Save file opens the picker (SaveFile).
3. **Predictive back:** on the PIN pad after Home → resume, a back swipe pops nothing. In a chapter, back unwinds Find → Focus → leave, with the peek animation.
4. **Keyboard:** open Settings and focus Public reader URL, then Author token. Both scroll fully above the IME. Repeat on Lock (recovery code field) and New novel.
5. **Preview pause:**
   - Open Live Preview on a chapter with ambient audio and a lighter or ghost cue, then press Home. Audio stops at once and does not resume until you return.
   - Run `adb shell dumpsys meminfo dev.kinetic.writer`, then `adb shell "ps -A | grep -i sandboxed_process"` and `adb shell dumpsys meminfo <that pid>`. Note the PSS of the host and of the isolated WebView.
   - Run `adb shell am kill dev.kinetic.writer:sandboxed_process0`, or `adb shell kill <pid>` if your build allows it. The preview remounts at the same block.
   - Settings → Accessibility → Remove animations: the preview switches to Reduced.
6. **FLAG_SECURE:**
   - With Master Lock on, open Recents: the thumbnail is blank and a screenshot is refused.
   - Turn "Hide in app switcher" off: Writer screens can be captured, but the PIN pad still cannot.
   - With Master Lock off, everything can be captured except the PIN and recovery screens.
7. **Backup:**
   - Run `adb shell bmgr enable true; adb shell bmgr backupnow dev.kinetic.writer`. Expect "Backup is not allowed" or "Package dev.kinetic.writer with result: Transport rejected"; no data is uploaded.
   - Run `adb shell dumpsys package dev.kinetic.writer | Select-String ALLOW_BACKUP`. `ALLOW_BACKUP` must not be in the flags.
8. **Phase 4A Zippo chimney:** in Sandbox → `bl-lighter-flick` on high, the flame sits in the chimney opening, with no clipping on lite and reduced.

## 6. Blockers or Open Decisions

- **Device transfer drops manuscripts by design**, because the directive excludes the DB from `<device-transfer>`. Authors moving to a new phone must use "Back up now" (a `.zip`) and restore it. Should onboarding or Settings copy mention this?
- **No device run yet:** release AAB, recovery-on-kill, FLAG_SECURE and `bmgr` are unverified on hardware; run §5. writer-shots has no dedicated screenshot of the LockHome "Hide in app switcher" row, because it only renders with a PIN set.
- The new reader→host `kn-preview-position` message goes beyond the two messages the directive named. It was needed to replay the scroll position.
- `pnpm smoke` still needs global Playwright plus `NODE_PATH`. Add `playwright` as a root devDependency?
