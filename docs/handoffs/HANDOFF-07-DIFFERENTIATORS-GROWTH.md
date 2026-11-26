# HANDOFF-07 — Differentiators & Growth
Branch `feat/dir-07-differentiators-growth`, off `main` @ `d0e8645` (DIRECTIVE-06 merged, #12).

Main session (Opus 5.5): Phase A, Phase E, 9:16 Record Mode, review wiring, integration, prebuild/Gradle, QA shots. 2 `builder-sonnet` workers on disjoint files: the module + Royal Road, and teaser + i18n + review policy. `qa-runner`: final sweep.

## 1. Help polish, LitRPG System Box, Royal Road

- **A1 Help emoji.** `GimmickGuideSection` renders `meta.name` only (it was `${meta.icon} ${meta.name}`). The row icon stays Feather.
  - Shot gate: the guide text has no `\p{Extended_Pictographic}` characters.
- **B1 `packages/modules/litrpg-system-box/`** (schema, card, index barrel, renderer, styles, sfx, `system-box.test.ts`).
  - Props: `header`, `variant` (`level-up` gold / `quest` emerald / `skill` cobalt / `warning` crimson), `title`, `lines` (1–8), `sound`.
  - Tiers:
    - `high`: one 0.8 s scanline sweep, no flashing (WCAG 2.3.1).
    - `lite`: 0.3 s fade.
    - `reduced`: a static card with no sound. `prefers-reduced-motion` CSS also kills both animations.
  - Text goes in via `textContent` only. All timers and audio nodes are tied to teardown. The chime (2 sine partials, low gain) plays once in `trigger()`, not at mount.
  - **Genre:** core's `moduleGenres` is frozen and has no LitRPG value, so `meta.genre = 'core'`. The writer shows "LitRPG / Progression" and Feather `terminal` via `MODULE_GENRE_OVERRIDE` in `help-content.ts`.
  - **Constitution note:** CLAUDE.md §2 forbids RPG/stat _systems_. This module only displays Author-written text lines: no state, no variables, no stats logic. It was explicitly requested by this directive.
  - **Lazy loading:** the reader discovers modules through `import.meta.glob`, so the box is a lazy chunk with no reader edit. The `/sandbox` route lists it automatically.
  - Writer: registered as module #7 in `registry.ts` (schema-driven cue form). `gimmick-text.ts` gives it a transcript branch (`header title` + lines) placed ahead of the dialogue heuristic.
- **B2 Royal Road.** Pure `export/royal-road.ts` `buildRoyalRoadHtml(book, opts)` emits an HTML fragment:
  - No `<style>`, `<script>`, `<html>` or class attributes; all text is escaped.
  - `<strong>/<em>/<u>/<s>/<hr>`; dialogue as `<p><strong>Speaker:</strong> …`.
  - Each System box becomes `<table style="border-collapse:collapse;width:100%;background:#0c2340;color:#eef6ff;border:2px solid <accent>;margin:1em 0;">`. The default `skill` accent is exactly `#3b82f6`.
  - The other 6 modules use the `gimmick-text` fallbacks as `<p><em>`. `omit` drops all cues.
  - Format `'royalroad'` saves `<stem>.html`. Compiler tile `export-royalroad` (Feather `share-2`, "Royal Road HTML · Ready to paste").
  - **Copy Royal Road HTML** (`export-royalroad-copy`) uses `expo-clipboard`. This dependency was added for that action (Kotlin only, 0 `.so`, 0 permissions).
  - The shot gate reads the real clipboard and finds the inline table with no script or style tags.
  - The grid now has 9 tiles, so Print sits alone on the last row.

## 2. 9:16 BookTok / Reels Teaser Exporter

- **Model.** `teaser/teaser-model.ts` ranks ≤ 5 pull-quote candidates from prose and dialogue (60–280 chars, markup stripped) and clamps to 280.
  - Optional gimmick badge; 3 presets: Midnight Ink, Warm Paper, System Glow.
  - `TEASER_SIZE` is 1080×1920, and a shared font-size helper keeps web and native layouts identical.
- **TeaserSheet** (a Sheet, not a route) opens from Chapter Editor ⋯ › "Create 9:16 teaser" (`menu-create-teaser`, Feather `smartphone`) and from Novel Outline ⋯.
  - The Outline entry picks the first quotable chapter; there is no chapter picker yet.
  - Controls: a live scaled 9:16 card (`teaser-card`, measured ratio 1.778), the preset switcher, quote candidates plus an editable ≤ 280 input, a cover toggle, **Export 9:16 PNG** and **Open 9:16 Record Frame**.
- **Native export:** `react-native-view-shot` 6.1.1 `captureRef` at 1080×1920 PNG, delivered through the existing `deliverBytes` path.
  - It passed prebuild and `compileReleaseKotlin` on RN 0.88.1 (Kotlin only, 0 `.so`), so the fallback was not needed.
  - Its TS sources fail our `verbatimModuleSyntax`, so it is loaded through a locally typed `require`.
  - **The PNG export is not runtime-verified on a device.**
- **Web export:** `teaser-export.web.ts` draws on an HTML `<canvas>`. That file is the only canvas user; Hermes JS has none.
- **Record Mode:** `/preview?…&record=9x16` frames the reader in a centred 9:16 box on black (`RecordStage`).
  - "Hide controls" removes the header, tier bar and status bar; tapping the letterbox brings them back.
  - A new `{type:'record'}` host control makes the reader hide its own `.kn-bar` and scrollbar. It lives in the lazy preview chunk, so it costs 0 B of initial JS.
  - Authors capture with Android's screen recorder; reader audio is capturable via `ALLOW_AUDIO_PLAYBACK_CAPTURE`.

## 3. i18n, In-App Review, Android Widget

- **i18n** (`expo-localization ~58.0.5`: 0 `.so`, 0 permissions).
  - `i18n/strings-en.ts` is the canonical dictionary. `strings-es.ts` is typed `Record<StringKey,string>`, so a missing key is a type error.
  - `t()` does `{{param}}` interpolation with a runtime English fallback. Also `resolveLocale('system'|'en'|'es', deviceLocales)` and `formatNumber`/`formatDate` (Intl with a safe fallback).
  - `I18nProvider` sits in `_layout.tsx`. The override persists as `AppSettings.language` (default `system`). The Settings › **Idioma/Language** row uses Feather `globe` (`settings-language-{system,en,es}`).
  - Wired: tab bar, nav rail, Library, Settings, Help headings, Trash.
  - **Not yet translated:** the Compiler, BackupSection, TrashRow, the remaining Help sections, `routes.ts` labels, and some card subtitles ("Recent", "1 season · 1 chapter").
  - All testIDs are unchanged. The Spanish shot shows 0 px horizontal overflow.
- **In-app review** (`expo-store-review ~58.0.3`: 0 `.so`, 0 permissions).
  - Pure `settings/review-prompt.ts` persists `{firstSeenAt, activeDays, milestonesCompleted, promptHistory}` at `setting/review-prompt`.
  - `shouldRequestReview` returns true only when all of these hold:
    - The trigger is `export|publish|backup|teaser` (never typing or launch).
    - There are ≥ 3 active days and ≥ 500 authored words (the demo novel is excluded).
    - The app is not locked and there was no crash this session (the local crash ring is empty).
    - It is ≥ 90 days since the last prompt and there were < 2 prompts in the last 365 days.
  - There is **no** custom rating-gate dialog: it calls `StoreReview.requestReview()` directly after `isAvailableAsync()`. Web is a no-op.
  - Wired after a saved export, a successful publish, a manual backup (saved or mirrored) and a saved teaser PNG.
- **Widget (pure Kotlin, 0 libraries, 0 `.so`).**
  - `widget/widget-state.ts` builds the payload. With Master Lock on (or a per-item lock on the novel or chapter): headline "Imagination Engine", subline "Tap to unlock and write", words "Protected", deep link `kinetic-writer://`.
  - Unlocked, it shows the chapter title, the novel title, "N words today" and `kinetic-writer://novel/<id>/chapter/<season>/<chapter>`.
  - `widget-sync.ts` skips trashed items. It runs after every chapter save and from `LockGate` on workspace open and every lock-config change.
  - `widget-bridge.ts` calls `NativeModules.KnWidget`; the web version is a no-op.
  - `plugins/android-widget.js` (+ `-res.js`, chained from `with-android-release.js`) generates:
    - `KnWriterWidgetProvider.kt`, with a `PendingIntent` using `FLAG_IMMUTABLE|FLAG_UPDATE_CURRENT`.
    - `KnWidgetModule.kt` + `KnWidgetPackage.kt`, which write `kn_writer_widget` SharedPreferences and broadcast `APPWIDGET_UPDATE`.
    - Layout, a 24dp rounded background, and colours for values / -night / -v31 / -night-v31 (Material You `system_*`).
    - `kn_writer_widget_info.xml` (`180×80dp`, `resizeMode="horizontal|vertical"`, **`updatePeriodMillis="0"`**, push-only).
  - "Words today" = the last novel growth snapshot today minus the last one before today. Growth snapshots are throttled to 5 min, so the count can lag by up to 5 min.

## 4. Prebuild & verification sweep

- `expo prebuild --platform android --clean --no-install`: OK.
  - `--clean` drops `local.properties`; I re-added `sdk.dir` (git-ignored) before Gradle.
- `gradlew :app:processReleaseMainManifest :app:compileReleaseKotlin`: **BUILD SUCCESSFUL** (1m 21s, JDK 17.0.21). It compiles `KnWriterWidgetProvider.kt` with expo-localization, expo-store-review, react-native-view-shot and expo-clipboard.
- Merged release manifest:
  - Present: `KnWriterWidgetProvider` receiver (exported, `APPWIDGET_UPDATE`, `android.appwidget.provider` meta-data), `targetSdkVersion="36"`, `allowBackup="false"`, `fullBackupContent` + `dataExtractionRules`, `autoVerify="true"`.
  - **`enableOnBackInvokedCallback`: 0.**
  - Restricted permissions (`MANAGE_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `CAMERA`, `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`): **0**.
  - Permission set: INTERNET, ACCESS_NETWORK_STATE, USE_BIOMETRIC, USE_FINGERPRINT, VIBRATE, DYNAMIC_RECEIVER_NOT_EXPORTED.
- **New `.so`: 0.** None of the 4 new native packages has any `.so` or `CMakeLists.txt` under `android/`. I did not run a full `assembleRelease` `.so` diff.
- `qa-runner` sweep:
  - `pnpm check`: typecheck ×3 + ESLint (0 warnings) pass; **95 files / 961 tests pass** in 27 s. The 6 new suites contribute 56 tests: system-box 6, royal-road 6, teaser-model 7, i18n 13, review-prompt 16, widget-state 8. Also `android-widget-plugin.test.ts`, 3 tests.
  - `pnpm build` + `bundle-report.mjs`: **initial reader JS 19.5 KB gz** (`main` 6.7 + `module-host` 12.8), under the 19.7 target and the 20.0 cap. The `litrpg-system-box` lazy chunk is **0.8 KB gz**.
  - `smoke.mjs`: 39 ✅ / 0 ❌. `litrpg-system-box` renders title + 3 lines and runs **×20 No leaks** on high, lite and reduced. 0 console errors.
  - `writer-shots.mjs --shots qa-shots-dir07`: **144 ✅ / 0 ❌**. 0 console or page errors across the main, publish (smoke-publish) and tablet packs. The Dir-06 pass now moves to `regression/`, and its Help gate expects 7 modules.
  - `git diff 0246947..HEAD -- packages/core`: **empty**. No file is over 250 lines (78 changed or new).

## 5. QA screenshots (`qa-shots-dir07/`, git-ignored)

1. `01-help-no-emojis-and-7-modules.png`
2. `02-litrpg-system-box-preview-and-rr.png`
3. `03-booktok-9x16-teaser-studio.png` (System Glow card | Record Mode)
4. `04-settings-language-es.png` (Settings Idioma | Biblioteca)

## 6. Test Gate 3 focus & open decisions

- **RNSentry JNI 16 KB:** run the ELF alignment check on RNSentry's own JNI lib (carried over from D-06).
- **Widget:**
  - Add it to an Android 16 home screen, write, and confirm the title and word count update.
  - Enable Master Lock and confirm the widget flips to "Imagination Engine / Tap to unlock and write / Protected" with no title.
  - Tap it while locked and confirm it lands on the Library. Tap it unlocked and confirm it opens the chapter.
  - Check Material You colours in light and dark.
- **System Box:** check it in Live Preview on high, lite and reduced, plus the chime on high (sound on).
- **9:16 PNG export:** confirm it saves a full 1080×1920 PNG and that the scaled preview's `overflow:hidden` does not clip the capture. If it does, fall back to an offscreen full-size copy.
- **Record Mode:** screen-record with audio and confirm the reader audio is captured.
- **Carried over:** Read-Aloud stops in the background; hardware Escape closes Find; no landscape IME extract box; cover-inclusive SAF backup restore.
- **Open decisions:**
  - i18n covers core chrome only; translating the Compiler, Backup, Help body and card subtitles is follow-up work.
  - The Outline teaser entry has no chapter picker.
  - The Royal Road grid has an odd tile count.
  - `expo-clipboard` was added beyond the directive's dependency list, for Copy HTML.
