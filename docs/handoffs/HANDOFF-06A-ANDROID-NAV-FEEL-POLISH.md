# HANDOFF-06A — Android 13–15 Back Gesture, Press Highlights, Stack Transitions, Swipeable Root Tabs

Branch `feat/dir-06a-android-nav-feel-polish` off `main` @ `562e0c6` (HANDOFF-05). Opus 5.5 main ran
Phases A, C, D and E. One Sonnet worker ran Phase B, which main reviewed and amended (Android
ripple/wash double-tint). Haiku `qa-runner` ran the final sweep. No new dependencies, so no new `.so` files.

## 1. Android 13–15 Back Gesture Fix (P0, RN #58407)

- `app.json`: `predictiveBackGestureEnabled: true` removed.
- `plugins/with-android-release.js`: the old `"true"` injection is gone. The new `stripBackInvokedCallback()`
  deletes `android:enableOnBackInvokedCallback` from `<application>` and every `<activity>`, so
  whatever Expo prebuild emits (`"true"` or `"false"`), the attribute is **omitted**:
  - API 33–35 keep the legacy `onBackPressed()`, so Expo Router and `BackHandler` pop and unwind on every edge swipe.
  - API 36+ get predictive back natively from `targetSdk 36`, where `ReactActivity`'s `SDK_INT >= 36` check holds.
- Proof, from `npx expo prebuild --platform android --clean --no-install` and then
  `gradlew :app:processReleaseMainManifest :app:compileReleaseKotlin` (**BUILD SUCCESSFUL**, 1m 29s).
  The merged manifest `app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml` has:
  - `enableOnBackInvokedCallback`: **0 occurrences**. The generated main manifest also has 0.
  - Kept: `targetSdkVersion="36"`, `allowBackup="false"`, `fullBackupContent="@xml/backup_rules"`,
    `dataExtractionRules="@xml/data_extraction_rules"`, `autoVerify="true"`, and `KnInputModule.kt`/`KnInputPackage.kt` generated.
  - Restricted permissions: MANAGE_EXTERNAL_STORAGE, READ_MEDIA_IMAGES, CAMERA, RECORD_AUDIO and SYSTEM_ALERT_WINDOW each **0**.
- Test `src/settings/android-back-manifest.test.ts` (5): strips `"true"`/`"false"`; keeps allowBackup, backup XML
  rules and autoVerify; `app.json` has no predictive-back flag and still targets SDK 36.
- Route audit (A2):
  - Every drill-down uses `router.push`: Outline, Chapter, Note, Settings, Appearance, Lock, Doctor, Trash,
    Compile, Preview, New Novel and Growth.
  - `new-novel` deliberately uses `replace` to go to Outline, so Back returns to Library and not to the spent form.
  - `replace` remains only as a fallback for the editor and TopBar when there is no history (`canGoBack()` is false).
  - Root tabs live in one `/` route (§3): Back on Notes/Search goes to Library; on Library it exits.
  - `useBackIntercept` registers and unregisters inside `useFocusEffect`, so it never fires under a pushed
    screen. LockGate's listener registers on every relock, so it still runs first and swallows Back.

## 2. Press Highlights & Ripples (P1)

- Root cause: `CardGroup` had `paddingHorizontal: 16`, so a pressed row's wash floated 16 dp inside the rounded card.
- New `ui/press-shape.ts`, with pure helpers: `clipped(r)`, `circleBox(size)`, `boundedRipple(color)`, `withClip(style)` and `CARD_RADIUS`.
- `CardGroup`: `clipped(radius.md)`. Rows are full-bleed and dividers are inset 16 dp. `CardInsetContext` tells
  `ListRow` (`ui/Page.tsx`) to pad its own content. This fixes **Appearance & Fonts**, Master Lock, Document Doctor
  and Back up now with no change to those rows. The non-row card children (live-preview block, publishing
  fields, backup interval, wallpaper segment) pad themselves.
- `Press`: adds `overflow: 'hidden'` whenever its style has a radius. On Android it sets a bounded ripple in the
  wash colour and skips the static pressed wash so they never double-tint (main's amendment). Web keeps the wash.
- `PublishSettingsCard` **Test connection**: an edge-to-edge pressable inside the clipped card, with
  `overflow: 'hidden'` and the 16 dp padding _inside_ the surface. The wash and ripple fill the row and round
  with the card's bottom corners (shot 01).
- `ActionButton`: `clipped(radius.sm)`.
- `IconBtn`: a centred `circleBox(44)` (radius 22, clipped), so the top-bar icons and the token eye toggle press as
  circles and not off-centre squares.
- `hitSlopFor` / `MIN_TOUCH` are unchanged, so every control keeps its 48 × 48 dp target.
- Test `ui/press-shape.test.ts` covers card and button radius + clip, the IconBtn circle, the bounded ripple and `withClip`.
- Writer-shots gates: 8 settings cards report `overflow: hidden` with a radius, the Appearance row sits flush
  with its card, and Test connection clips with inner padding.
- Not changed: `SegmentControl`, `Toggle` and `Stepper` are raw `Pressable`s with no pressed wash or ripple, so
  there is nothing to clip.

## 3. Navigation Transitions & Swipeable Root Tabs (P1)

- `ui/use-reduce-motion.ts`: the shared hook, re-exported from `preview/use-host-signals.ts` so existing imports still work.
- `_layout.tsx` `<Stack>`: default `animation: reduced ? 'fade' : PUSH` (`ios_from_right` on iOS, else
  `slide_from_right`) with the theme-canvas `contentStyle`, so no white flash. `preview` uses
  `reduced ? 'none' : 'fade'` on `THEATER_BG`. `index`, `folders/index` and `search` use `'none'`. The tree order
  `[StatusBar, rail | null, View[Stack, TabBar]]` is unchanged, and the fold → unfold draft gate still passes.
- `RootTabsPager` (`components/RootTabsPager.tsx`) hosts the 0 Library, 1 Notes and 2 Search pages in the `/`
  route, built on `Animated` + `PanResponder` with no native deps.
  - Follows the finger 1:1 (resisting past the ends). Past 25% of the width, or a flick over 0.5 dp/ms, it
    commits with a velocity-carrying spring (native driver; see HANDOFF-06A-2). Reduce Motion and the rail are instant.
  - **Edge dead zone:** swipes starting within 32 dp of either edge are never claimed. The start is computed as
    `moveX - dx`, because PanResponder leaves `x0` at 0 until grant; this bug surfaced in testing.
  - **Scroll yield:** the pager claims only when `|dx| > 16` and `|dx| > 1.5·|dy|`. `RecentStrip`'s carousel
    marks its touches (`claimInnerHorizontal`), so dragging it never switches tabs.
  - Leaving Search calls `Keyboard.dismiss()`. On tablets (≥ 600 dp) drag capture is off.
  - Inactive pages are `aria-hidden`. Neighbours mount 1.2 s after first idle (or at drag start). Only the
    visible page sets header actions (`ui/ScreenOptions.tsx`).
- Route sync (`components/root-tab.ts` external store and `RootTabRoute.tsx`):
  - `/folders` and `/search` set the tab, then `router.dismissTo('/')`, which pops to the shell or replaces the
    deep link. Bookmarks, breadcrumbs and tests keep working, and screens never duplicate.
  - Tab taps from a sub-folder set the tab and pop to `/`. `aria-selected` now reaches the DOM on tabs and the rail.
- Code moves: the screen bodies went to `library/LibraryView.tsx` and `search/SearchView.tsx`.
- Test `components/tab-pager-math.test.ts` (10): dead zone (x = 10 and width − 12 rejected, 60 accepted),
  horizontal intent, 25%/flick snaps, clamping to [0, 2], drag resistance, Back 2 → 0, 1 → 0, exit from 0.

## 4. Prebuild & Verification Sweep (`@qa-runner`)

- **Prebuild + Gradle:** `:app:processReleaseMainManifest :app:compileReleaseKotlin` returned **BUILD SUCCESSFUL**.
  The merged-manifest results are in §1. `package.json` and the lockfile are unchanged, so **0 new `.so`** files.
- **`pnpm check`:** typecheck x3 and ESLint (0 warnings) pass; Vitest **82 files, 853 tests passed** in 24 s.
  The qa-runner's run hit one wall-clock flake: `search-index` asserts a 20-chapter build in < 50 ms and took
  93 ms while Gradle and the export ran in parallel. `search-index.ts` is untouched; the rerun passed.
- **`pnpm build` + `bundle-report.mjs`:** reader initial JS is **19.4 KB gz** (6.7 + 12.7), unchanged. No chunk is over budget.
- **`pnpm writer:export` + `writer-shots.mjs --shots qa-shots-dir06a`:** exit 0, **120 ✅ / 0 ❌**, 120 s. That
  is 106 earlier gates plus 14 new D-06A gates: card clipping ×3, edge dead zone, RecentStrip yield, vertical
  yield, finger tracking, settle on Notes, settle on Search, tab-tap animate, single `/` route, `/search` and
  `/folders` deep links, and rail switching. Console and page errors were 0 for phone, `smoke-publish` and tablet.
  Playwright resolves from the global install (`NODE_PATH="$(npm root -g)"`).
- **Frozen fences:** `git diff 0246947..HEAD -- packages/core` and `git diff HEAD -- apps/reader` are both **empty**.

## 5. Captured QA Screenshots (`qa-shots-dir06a/`, git-ignored)

1. `qa-shots-dir06a/01-settings-card-highlights.png`: the Publishing card with the Test connection wash clipped
   to the card's rounded bottom, and the Privacy card rows full-bleed.
2. `qa-shots-dir06a/02-root-tabs-library-to-notes.png`: mid-swipe on a 390×844 phone, with Notes tracking the
   finger at 270 px and the RecentStrip intact.
3. `qa-shots-dir06a/03-tablet-rail-tabs-intact.png`: 1280×800, with FolioNavRail switching to Notes inside the
   pager. The editor draft-survival gate passes in the same run.

## 6. Quick Physical Android 15 Phone Smoke Check (results: `HANDOFF-06A-2-PHONE-SMOKE-FOLLOWUP.md`)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-android-apk.ps1 -Abi arm64-v8a -Install
adb shell dumpsys package dev.kinetic.writer | Select-String targetSdk
```

1. Open a novel, then a chapter. Edge-swipe back from the left **and** the right edge: you should land on
   Outline and then Library, and the app must **not** close until you swipe back on Library.
2. In Settings, press and hold **Appearance & Fonts**, **Test connection** and the token 👁. Each ripple should
   fill its row edge to edge with rounded corners, and the eye should press as a clean circle.
3. On Library, swipe left from mid-screen to Notes and then Search, and drag the Recent strip. Only the mid-screen
   swipes should change tabs. A swipe starting at the screen edge must trigger system back and never switch tabs.
4. On Search, type a query, then swipe right: the keyboard should close. Press Back on Notes or Search to return to Library.
