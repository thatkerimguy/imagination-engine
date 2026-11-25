# HANDOFF-03 — Gate 1 Fixes, Large-Screen Adaptive UI, Hardware Keyboard & A11y / Calm Mode

- **Branch:** `feat/dir-03-large-screen-a11y` off `main` @ `5f643c1`. `packages/core` untouched.
- **Workers:** Opus 5.5 main (Phase A, B, keyboard bridge, native plugin, shots). Sonnet worker 1 (shortcut table + tests,
  `ShortcutsSheet`, 48 dp / TalkBack audit). Sonnet worker 2 (Reader Calm Mode). `@qa-runner` (Haiku) ran the final sweep.

## 1. Gate 1 Fixes Verification

| Finding                         | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **FAIL** Settings IME clearance | **Fallback path, not `react-native-keyboard-controller`.** v1.24 peer-requires `react-native-reanimated >= 3`, which is not in the app. Adding Reanimated + Worklets (2 new `.so`, Babel plugin) only to scroll a form is the native fight the directive says to avoid. New `ui/use-ime-reveal.ts`: on Android `keyboardDidShow`, after Page's existing keyboard-height padding lands (60 ms), it does `TextInput.State.currentlyFocusedInput().measureInWindow` → `computeRevealScroll` (pure, unit tested) → `ScrollView.scrollTo`, so the field sits 24 dp above the keyboard top. The keyboard top is the conservative `min(screenY, windowHeight − height)`. No `KeyboardAvoidingView`, and `insets.bottom` is not added twice. Covers `settings.tsx`, `lock.tsx` and `new-novel.tsx` (all use `Page`). |
| Cosmetic: 3-button nav icons    | New `KnInput.setLightNavigationBars(light)` native method (`WindowInsetsControllerCompat(window, decorView).isAppearanceLightNavigationBars`, UI thread). It sets no nav-bar colour. JS `ui/system-bars.ts` → `useNavigationBarStyle(light)` keeps a mount-ordered stack: `_layout.tsx` passes `!dark` (live with theme changes) and `preview.tsx` passes `false` (dark Theater). Unmounting Preview restores the theme's request. No-op on web, iOS and Expo Go.                                                                                                                                                                                                                                                                                                                                            |
| Observation: Preview tier       | `preview/OsReducedPill.tsx`: a warm `Reduced (OS)` pill in the Preview status line while `useReduceMotion()` is true. TalkBack reads "OS Reduce Motion is on, so the Reduced tier is enforced". `testID="preview-os-reduced"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

`ALLOW_AUDIO_PLAYBACK_CAPTURE` is deliberately left enabled.

## 2. Large-Screen & Split-Pane Summary

- **Orientation:** `app.json` sets `orientation: "default"` and `ios.supportsTablet: true`. After prebuild, MainActivity has
  `android:screenOrientation="unspecified"` and no `resizeableActivity`.
- **Breakpoints:** `ui/layout-class.ts` is pure: `compact < 600 ≤ medium < 840 ≤ expanded`, plus `gridColumns`, `usesRail`,
  `READING_MAX = 720` and `REFERENCE_PANE_WIDTH = 380`. Tests cover 386 dp (desktop-windowing minimum) through 1280 dp.
  `useLayoutClass()` lives in `ui/use-layout-class.ts` (`useWindowDimensions`), so the classifier stays importable from Vitest.
- **Navigation Rail:** `components/FolioNavRail.tsx` is 80 dp wide, with Feather icon and label, a soft accent indicator,
  `tablist` / `tab` + `selected`, and top/left/bottom insets. It shares routing with the tab bar (`tabNavigate`).
  `FolioTabBar` returns null at ≥ 600 dp, so phones keep the exact current bar.
- **Shell:** `_layout.tsx` is a row with `[StatusBar, rail | null, View[Stack, TabBar]]`. Every layout class uses the same
  element positions, so the Stack (and every mounted screen) never remounts on rotate, fold or resize.
- **Measure and grids:**
  - `Page` gets `maxWidth 720` centred on Medium/Expanded. A new `wide` prop opts out (used by Library and Notes).
  - `ChapterEditor` and `NoteEditor` scroll content are centred at 720 dp.
  - `ui/Grid.tsx` gives 1/2/3 columns for the Library novels (`library-grid`) and the Notes folders/docs (`notes-grid`).
    One column renders the original list untouched. Row ⋯ menus are `PopoverMenu` modals, so cells cannot clip them.
- **Split pane (`>= 840 dp`):**
  - A Feather `sidebar` toggle in `EditorTopBar` (`reference-toggle`, shown on Expanded only) opens
    `editor/ReferencePane.tsx` (380 dp) beside the editor column.
  - Its segment switches between **Outline** (reuses `outlineEntries`; a tap jumps the live editor) and **Notes**
    (all Notes docs, newest first; tap to expand read-only text).
  - The pane is a back/Escape layer, and it hides itself below 840 dp.
- **Draft survival:** the pane is a sibling of the unchanged editor column. `useChapterDraft`, selection and undo history live
  in components whose tree position never changes. `writer-shots-tablet.mjs` types unsaved text, resizes 1280 → 390 → 1280,
  and asserts the text and the open pane survive.
- **Line budget:** `ChapterEditor.tsx` was at 250 lines. Block handlers, `jump` and the deep-link effect moved to
  `use-block-handlers.ts`; the menu wiring moved to `chapterMenu()`. It is still 250.

## 3. Hardware Keyboard & Accessibility / Calm Mode

- **Shortcut table:** `editor/shortcuts.ts` is pure and tested. It handles Ctrl on Android/Windows/Linux and Cmd on macOS web
  (the other modifier or Alt is rejected). Bindings: B/I/U, Z, Shift+Z/Y, F (toggle Find), S (`draft.flush()`), P (Preview),
  `/` (`ShortcutsSheet`), Escape (closes sheet → colour popover → Find → Reference pane → Focus).
- **Bridge:** native `MainActivity` plus `DeviceEventEmitter`, not `react-native-external-keyboard`. So: zero new deps and
  zero new `.so`.
  - New `plugins/android-input.js` (required from `with-android-release.js`; `with-android-polish.js` stays at 249) generates
    `KnInputModule.kt` and `KnInputPackage.kt`.
  - It also adds `MainActivity.dispatchKeyEvent` (Ctrl+key → `knShortcut` event; only while the editor is focused,
    `setShortcutCapture`; Meta is left to the system) and `onProvideKeyboardShortcuts`.
  - JS: `shortcuts-bridge.ts` (Android), `shortcuts-bridge.web.ts` (capture-phase `keydown`, because the focused prose
    TextInput stops bubbling; handled keys `preventDefault`), and `use-editor-shortcuts.ts` (`useFocusEffect`, so Preview
    on top never sees editor keys).
  - On Android, Escape is the system Back fallback and already flows through `useBackIntercept`.
- **`Meta+/` helper:** `onProvideKeyboardShortcuts` adds the "Kinetic Writer · Chapter editor" group (10 Ctrl rows).
  `shortcuts-native.test.ts` asserts the plugin's `HELPER_SHORTCUTS` matches `SHORTCUTS` labels/combos and that every row
  dispatches through `matchShortcut`. `:app:compileReleaseKotlin` passed (JDK 17), with only the pre-existing Expo template
  deprecation warning. The on-device `Meta+/` overlay is not yet seen (Gate 2).
- **ShortcutsSheet:** `editor/ShortcutsSheet.tsx` opens from Ctrl+/ or the editor ⋯ menu → "Keyboard shortcuts".
  On web, Tab/Shift+Tab/Escape work in `Sheet` and `ConfirmDialog` (`onRequestClose`). Their scrims are now `focusable={false}`
  so the first Tab stop is a real control.
- **48 dp / TalkBack:**
  - `ui/a11y.ts`: `MIN_TOUCH = 48` and `hitSlopFor()`. `Press.slop` now delegates to it, which lifts `PopoverMenu`,
    `BlockStrip`, `ColorControl` and `ToolbarChevron`.
  - `IconBtn`, `Toggle` and compact `Stepper` reach 48 dp via hitSlop. Visuals change only slightly: `FormattingToolbar`
    buttons/bar and `GimmickPill` are 48 high, and `Stepper` buttons are 48 wide.
  - `SegmentControl` segments: `minWidth 48`. `ChapterRow`: title and status reach 48 via slop.
  - Roles/states: `Stepper` has `disabled` and an `adjustable` value. The rail/tab bar use `tab` + `selected`. The Reference
    toggle has `selected` and a state-aware label.
  - Reorder already has single-tap Move up/down (block strip arrows, chapter ⋯ menu), so there are no gesture-only traps.
  - Static/unit regressions are in `ui/a11y.test.ts`.
- **Reader Calm Mode:**
  - `prefs.calmMode` (default false) is an override layer. Stored `tier` and `sound` are never rewritten, so Off restores them.
  - Tier: `deviceHints(opts.reducedMotion || calmMode)` gives `'reduced'` for all 6 modules, ORed with the Writer preview's
    a11y message.
  - Audio: `soundAllowed()` feeds `audio.setSound` (master-gain fade) live from the drawer.
  - A one-tap `role="switch"` sits at the top of the `Aa` drawer (`data-testid="calm-mode"`, caption "No motion, muted
    effects", 48 px). Tests are in `tier.test.ts`.
  - **Bundle impact: initial JS 18.9 → 19.0 KB gz (≈ +0.1 KB).**

## 4. Verification Sweep (`@qa-runner`)

| Step                                                    | Result                                                                                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                                            | **PASS** in 19 s: typecheck ×3, ESLint 0 warnings, **69 files / 765 tests**                                                |
| `pnpm build` + `bundle-report.mjs`                      | **PASS**: initial reader JS **19.0 KB gz** (≤ 20.0), "Bundle budget OK."                                                   |
| `pnpm build:preview-bundle`                             | **PASS**: 737.2 KB raw / 198.3 KB gz, Calm Mode included                                                                   |
| `smoke.mjs` (incl. `smoke-pack-1`, ×20 leak checks)     | **PASS** in 419 s: **33 ✅ / 0 ❌**, zero console errors                                                                   |
| `writer-shots.mjs` (phone + smoke-publish + tablet)     | **PASS** in 101 s: **81 ✅ / 0 ❌** (tablet pack 10 ✅), 0 console/page errors in every pack                               |
| `expo prebuild --platform android --clean --no-install` | **PASS**: targetSdk 36, `enableOnBackInvokedCallback`, `allowBackup=false` and backup XML rules kept; `KnInput*` generated |
| `gradlew :app:compileReleaseKotlin` (extra)             | **BUILD SUCCESSFUL** in 1 m 34 s                                                                                           |
| `git diff 0246947..HEAD -- packages/core` / files > 250 | empty / none                                                                                                               |

## 5. Captured QA Screenshots (`qa-shots-dir03/`, git-ignored, attached)

1. `01-tablet-library-rail-grid.png`: 1280×800, left rail, Library as a 3-column grid, no bottom bar.
2. `02-tablet-editor-split-pane.png`: centred 720 dp prose column with the Reference pane (Outline) open and the toggle active.
3. `03-reader-calm-mode-settings.png`: Reader `Aa` drawer (768×1024) with **Calm Mode: On** at the top.

## 6. Blockers or Open Decisions

- **No new native `.so`.** Neither keyboard package was added: only 2 Kotlin classes plus MainActivity overrides. The 16 KB
  verifier count should stay 52/52. Test Gate 2 must check on device: the IME reveal on Settings (`publish-reader-url`),
  dark nav icons in a light theme, the `Meta+/` overlay, and Ctrl+B/Z/S from a Bluetooth/Chromebook keyboard.
- **Calm Mode timing:** tier and motion changes apply from the next chapter opened. Sound applies live. If Calm is on when the
  curtain opens, audio stays locked until a later chapter's curtain (the browser needs a gesture).
- **Ctrl capture is editor-only.** Outside the Chapter Editor, Android TextInputs keep native Ctrl+Z/C/V. `FormattingToolbar`
  buttons stay `focusable={false}` on web (so a click never steals the text selection), so they are not Tab stops.
- `TOUCH` in `tokens.ts` is still 44 (visual row minimum). The 48 dp target now comes from `MIN_TOUCH` and hitSlop. A global
  bump to 48 would shift many layouts, so it is left for an explicit decision.
