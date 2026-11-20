# Phase 2 (Pass 2) Report: Bug Fixes and Material Design 3 UI

## Git & Build Verification

- Branch pushed: `main` and `claude/fervent-knuth-rfks3y`. Verified code is at `a8ce46e`; this
  report is the commit after it.
- Subagents:
  - **Main Opus session:**
    - M3 tokens with WCAG tests, plus ThemeProvider (Dark | Light | System).
    - All `src/ui/` primitives.
    - The custom Stack TopBar with `parentHref`.
    - Root cause and fix for P1 #4, with a regression check.
    - Integration, polish and the QA scripts.
  - **`@builder-sonnet` A:** Bookshelf, New novel, Outline, Novel Settings and App Settings.
  - **`@builder-sonnet` B:** Chapter Editor and Live Preview.
  - **`@builder-sonnet` C:** SchemaForm, GimmickSheet and the 10 field controls, plus
    `field-hints` tests.
  - **`@qa-runner`:** the full verification run.
- `pnpm check`: **PASS**. 23 test files, 152 tests, 0 lint warnings.
- `bundle-report.mjs`: `main` 5.7 KB + `module-host` 12.4 KB = **18.1 KB gzipped** (< 40 KB).
  The initial chunks contain no three.js or cannon-es code.
- Exports: `expo export --platform web` **PASS** (11 bundles).
  `--platform android` **PASS** (Hermes `.hbc`, 3.56 MB).
- Zero-Heavy-Imports: **PASS** (`boundary.test.ts`, ESLint fence, export grep).
  No UI kit is present: `react-native-paper` and `@react-native-material` are absent.
- Frozen Core: `git diff 0246947..HEAD -- packages/core` is empty.
- `smoke.mjs`: **PASS** with zero console errors. New: "preview from a mid-chapter block keeps
  beats sequential".
- `writer-shots.mjs`: **PASS** with zero console errors. Checks the Back button, the unclipped
  "Dice" label, KESTREL-9 finishing before the dice land, and the light theme.

## The 4 Pass 1 Bugs

1. **[P0] Clipped "Dice" label.**
   - **Root cause:** the Pass 1 screenshot script called `scrollIntoViewIfNeeded()` on
     "Material" after toggling the Outcome chips. That scrolled the sheet body, so "Dice" sat
     under the header edge in `04`. The old sheet also had a thin `bodyContent` top inset.
   - **Fix:** the M3 `BottomSheet` keeps a fixed header (handle, IconBadge, title, subtitle,
     close) outside the `ScrollView`, then an `outlineVariant` divider, then a body with
     `paddingTop: 16`. SchemaForm adds no negative margins.
   - **Check:** the script reopens the sheet at scroll 0 after the slide-in and asserts that
     "Dice" is at least 24px below the header title (it measured 191px from the top).
2. **[P0] No Back button in the Chapter Editor.**
   - **Root cause:** the native-stack header shows Back only when there is navigation history.
     A deep link or web reload into the editor had none.
   - **Fix:** every screen now uses the custom M3 `StackTopBar` (`ui/TopBar.tsx`), with a
     48dp leading `arrow-back` on every screen except the Bookshelf. If there's no history it
     calls `router.replace(parentHref(...))`. That function is pure and unit-tested: chapter
     goes to the outline, the outline to the shelf, and preview to its chapter.
   - Leaving the editor unmounts it, which flushes autosave as before.
3. **[P1] Duplicate number readout.**
   - **Root cause:** `NumberControl` rendered a centre `Text` value and a separate numeric input.
   - **Fix:** one `NumberStepper`: `[−] [editable 2] [+]`. Typed values snap to the step on
     blur or submit, and ± disables at the bounds. The range shows as supporting text through
     the tested `rangeHint()` helper: "1–3", "0.5–8 s".
4. **[P1] KESTREL-9 still decrypting while the dice landed in Live Preview.**
   - **Root cause:** in `apps/reader` `Pacer.start()`. Preview starts at the Author's focused
     block (the dialogue), so it takes the bookmark-restore path. That path replayed earlier
     modules (1) outside the beat queue, so the dice's `fire()` did not wait for them, and
     (2) only after awaiting the previous replay. On a cold page that let the near-observer
     create the KESTREL-9 host at full tier first, so the "calm" replay was a full live
     decryption.
   - **Fix:** create all replay hosts up front at `reduced` tier, and chain the replays onto
     `this.queue`.
   - **Proof:** a new smoke check (cold page, start at the dialogue) **failed before the fix**
     with `{calm:false, pending:1}` and passes after it. `writer-shots` also asserts that all 3
     lines were complete when the dice landed. The reader still has the same 18.1 KB initial JS.

## Material Design 3 System

- **Tokens:** `apps/writer/src/ui/m3-tokens.ts`.
  - Full dark and light colour roles from the teal seed `#4FD1C5` with an amber tertiary,
    including the specified surface-container ladder.
  - The type scale from `headlineSmall` to `labelSmall`.
  - Shape scale 4/8/12/16/28/full, `TOUCH = 48`, and state layers at 8–12%.
  - `m3-tokens.test.ts` checks 15 on/background pairs per scheme for WCAG AA (≥ 4.5:1); all pass.
  - Prose and dialogue inputs keep the serif `proseFont` (the editorial exception).
- **Theme:** `ui/theme.tsx`.
  - `ThemeProvider` resolves Dark, Light or System (`useColorScheme`). The choice is persisted
    in app settings as `appearance` and set by the App Settings segmented control.
  - `makeStyles()` caches one StyleSheet per scheme.
- **Primitives** in `ui/`, with no third-party UI kit. Icons come from `@expo/vector-icons`,
  which ships with Expo.
  - `TopBar`
  - `Button` (filled / tonal / outlined / text)
  - `IconButton`, `Fab` (extended)
  - `Chip` (filter chip: 8dp radius, ✓ when selected), `SegmentedButtons`
  - `Switch` (52×32, thumb 16 → 24 with ✓)
  - `TextField` (outlined; 2dp primary on focus; error and supporting text)
  - `BottomSheet` (28dp radius, 32×4 handle, fixed header, docked footer)
  - `Dialog` + `useConfirm()`, which replaces `Alert` / `window.confirm`
  - `OverflowMenu`, `StatePressable` (state layers)
  - `layout` (Screen, Card, StatusBadge, IconBadge, EmptyState)
- **Screens:**
  - **Bookshelf:** the Extended FAB `New novel`; card `⋮` menu with Export JSON and Delete
    (confirm dialog); Load demo in the empty state or the top-bar overflow menu.
  - **Outline:** season cards and chapter list items behind `⋮` menus, with status chips and
    `+ Season` as a FAB.
  - **Settings:** M3 Switches, check swatches, and Save in the top bar.
  - **Editor:**
    - Back button, save badge and a tonal Preview button.
    - Gimmick cards: IconBadge, `titleMedium`, one badge, and a beat-stop icon. The raw layer
      pill is gone.
    - A docked toolbar with vector icons.
    - Icon-button block actions and a segmented prose style picker.
  - **Sheets:** filter chips, the unified stepper, compact string-list rows, and
    Reset (text) | Save (filled).
  - **Preview:** a segmented tier bar and a Restart icon.
  - **App Settings:** Appearance, Reader URL and Reset demo.

## Known Limitations / Notes

- The top bar uses `surface` and doesn't switch to the scrolled `surfaceContainer` tint; that
  needs per-screen scroll wiring.
- The sheet slide uses RN `Modal`. There's no drag-to-dismiss gesture, so close with ✕, the
  backdrop or Android back.
- Still not exercised on a physical phone: SQLite, haptics, keyboard insets, the share sheet
  and WebView injection. These are verified only by the Android Hermes export and typecheck.
- Prose-style testIDs are now `prose-style-<id>-<style>`. The outline's top-bar testIDs are now
  `outline-settings` and `outline-export`.
