# HANDOFF-06 — Gate 2 / D-05 fixes, Onboarding, Help Hub, Author QoL, Privacy-First Observability

Branch `feat/dir-06-onboarding-qol-observability`, off `main` @ `d10d0a5`, which contains HANDOFF-05 `562e0c6`.

Main session: Phase A, E and integration. 2 `builder-sonnet` workers (disjoint files): `src/onboarding` + `src/help`, and Read-Aloud + Story Bible. `qa-runner`: final sweep.

## 1. Gate 2 & Directive 05 fixes

- **A1 Covers in workspace `.zip`.**
  - Code: pure `backup/archive-covers.ts` + `media/cover-archive.ts` (web: no-op).
  - Pack: every `file:` cover in `meta/item/*` (+ `.thumb.jpg`) goes in as `covers/<basename>`.
  - Restore validates names (`^[A-Za-z0-9][A-Za-z0-9.-]*\.(jpe?g|png|webp)$`, no `..`, ≤ 8 MB, ≤ 400 files), writes to this device's `Paths.document/covers/` and rewrites `meta/item/*` `coverUri` (thumbnails keep sibling names).
  - Tests: round-trip of the bytes with Doctor `[]`; traversal, non-image and oversize entries are rejected.
- **A2 Sidecar purge.** `sidecarKeysOf(id)` adds `meta/publish` and `versions/*` + `growth/*` for chapter, novel, doc and folder ids.
  - Tests: note + growth + meta → Trash → Empty trash gives **Doctor 0 findings**; deleting a book forever also gives 0.
- **A3** `.knbook` leaves out trashed seasons and chapters with their sidecars. Workspace backups still carry `trash/*`.
- **A4** `Delete forever` and `Empty trash` use `ActionButton variant="danger"`. A shot gate checks the danger surface.
- **A5 Android Escape.**
  - `KnInputModule.dispatch` forwards plain `KEYCODE_ESCAPE` (ACTION_DOWN, no modifiers) as `{key:'Escape', ctrl:false}` and returns `true`; `nativeKeyInput()` maps it to `escape`. Tested in `shortcuts-native.test.ts`.
- **A6** `disableFullscreenUI` is set on `RichProseInput` (all prose and dialogue, editor and notes), the speaker field and the note title.

## 2. Onboarding, Help Hub & Author QoL

- **Welcome tour.**
  - State: `setting/onboarding {completedAt?, dismissedAt?}`, checked by the pure `shouldShowOnboarding`.
  - It shows only when the demo is the only book and the tour was never finished or skipped.
  - `OnboardingLauncher` in the Library opens 3 steps, with Skip always in the header:
    1. Open Live Preview (Chrome Tide · Snake Eyes).
    2. Tap cue cards to customize a gimmick.
    3. New novel / Import .docx·.md·.txt (into Notes) / Restore backup, plus the SAF folder hint.
  - Replayable from Help. Regression gates seed "dismissed" (`skipOnboarding`); the Dir-06 shot uses a clean context.
- **Help & Legal** (`app/help.tsx` + `help/*`), reached from a `help-circle` row in Settings › Privacy & integrity:
  - Gimmick Guide generated from `writerModules`: 6 modules, Feather icon and accent per genre, trigger hint per layer.
  - Markup reference, shortcuts sheet, "Replay welcome tour"; backup / Trash / EPUB 3 / publishing cards; What's New v1.0.
  - Licenses (SIL OFL 1.1 fonts, MIT/Apache packages); privacy and terms summaries, `/legal/*` links, Doctor row.
- **Read-Aloud** (`expo-speech ~58.0.4`).
  - The library adds only a `TTS_SERVICE` `<queries>` entry, so **0 new permissions**.
  - Pure controller: transcripts for gimmick blocks, speeds 0.85 / 1 / 1.25 / 1.5×, prev and next, pause by stop-and-remember.
  - Injectable adapter (`speechSynthesis` on web, else no-op). Opened from ⋯ › Read aloud (`volume-2`), mounted only while reading.
  - Speech stops on unmount, on screen blur and when `AppState !== 'active'`.
- **Story Bible.**
  - Pure `story-bible.ts`: `@query` at the caret (emails ignored), title matching, insertion, excerpts; only non-trashed notes.
  - Opened by typing `@` in prose or dialogue, or from ⋯ › Story Bible (`book-open`).
  - Each row can insert `@Title` (the caret moves after it) or open a read-only peek card with "Open full note".
- **10k-word performance.**
  - `analyzeDocument` caches stats per block (a `WeakMap` keyed by block identity), so a keystroke re-tokenises only the edited block. Results match a cold run exactly (tested).
  - `ChapterBlocks.tsx`: memoized rows that own their `onLayout`, so siblings skip rendering. The editor stays a `ScrollView`.
  - **Bench, 250 blocks / 10,001 words:** edit plus metrics recompute takes **≈ 1.1 ms**, down from ≈ 16 ms uncached. The gate is 16 ms.

## 3. Privacy-first observability & redacted diagnostics

- **Crash reporting.**
  - `CrashReporterPort` (`init`, `disable`, `captureException`, `setRouteSegments`) plus a local-only ring buffer of 20 errors.
  - Native adapter: **`@sentry/react-native` 8.28.1**, which pulls in `sentry-android` 8.57.0. Web adapter: a no-op.
  - Lazily imported; starts only after the first frame, with `crashReportingEnabled === true` (default **false**) and `EXPO_PUBLIC_SENTRY_DSN` set. Toggling off calls `close()`.
- **Zero-PII scrubbing** (`scrub-event.ts`, 9 tests). Each event is rebuilt from an allow-list:
  - Kept: error type, sanitised value, frames (basename, function, line, column, in_app), OS + app version, `route` tag, SDK / debug metadata. Everything else is dropped.
  - Error values are redacted: quoted text, paths, URLs, emails, `Bearer` tokens, `key=` values, long ids.
  - `beforeBreadcrumb` keeps only our own `kn.route` breadcrumbs.
  - SDK: `sendDefaultPii`, screenshots, view hierarchy, threads off; replay and tracing 0; auto / console / network breadcrumbs off; device and navigation integrations removed.
  - Native crash handling, NDK and tombstones are **off**, so no event can skip `beforeSend`.
- **Routes** come from `useSegments()` only (never `usePathname()`). Unknown segments are recorded as `[?]`.
- **Builds without a token.**
  - `plugins/with-sentry-optional.js` adds Sentry's upload plugin only when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` are all set. `metro.config.js` follows the same rule.
  - `pnpm-workspace.yaml` sets `allowBuilds: {'@sentry/cli': false}` to skip the CLI binary download.
- **Redacted diagnostic report** (`redact-report.ts`, 4 tests): app version, platform/OS, known module ids, item counts, backup age, external-folder link, crash opt-in, local crash types, and Doctor findings as `repair@area` codes with severity × count. No keys, ids, titles, URLs or filenames. Doctor's "Export diagnostic report" saves it as `.txt` via `deliverText`.

## 4. Prebuild & verification sweep

- **Android build.** `expo prebuild --platform android --clean --no-install` passes. With the Sentry variables **unset**, `gradlew :app:processReleaseMainManifest :app:compileReleaseKotlin` gives **BUILD SUCCESSFUL** (1m 14s, JDK 17).
- **Merged release manifest.**
  - `targetSdkVersion="36"`, `allowBackup="false"`, `autoVerify="true"`, and the backup / data-extraction XML rules are in place.
  - **0 restricted permissions.** One new permission, `ACCESS_NETWORK_STATE`, comes from Sentry (normal, granted at install).
  - `enableOnBackInvokedCallback` is **absent on purpose**: 06A strips it (see §6).
- **New `.so` files** (all Sentry): `libsentry.so` + `libsentry-android.so` × 4 ABIs; arm64 and x86_64 **pass 16 KB** (`elf-align.mjs`). RNSentry's own JNI lib is built from source; Gate 3 should check it.
- **`qa-runner`:**
  - `pnpm build`: reader initial JS **19.4 KB** gzipped (limit 20.0), "Bundle budget OK".
  - `writer-shots.mjs --shots qa-shots-dir06`: **133 ✅ / 0 ❌**, exit 0, including the 32 publish-pack gates. Zero console or page errors, tablet pack included.
  - `git diff 0246947..HEAD -- packages/core`, `git diff HEAD -- apps/reader` and `git diff d10d0a5 -- apps/reader` are all **empty**.
- **`pnpm check`:** the sweep hit one lint error (unused `shot` in `writer-shots-dir06.mjs`); after the fix: typecheck ×3, ESLint 0, **Vitest 88 files / 898 tests (4.5 s)**; the 10 Dir-06 suites (68 tests) pass.
- **File sizes.** Every new or changed source file is ≤ 250 lines (ChapterEditor 248, writer-shots 249). `scripts/smoke.mjs` (268) was over before and is untouched. No `any`.

## 5. Captured QA screenshots (`qa-shots-dir06/`, git-ignored; older packs moved to `regression/`)

1. `01-onboarding-micro-tour.png`: Welcome sheet on a fresh workspace (Skip, step dots, Open Live Preview).
2. `02-help-legal-center.png`: the 6-module Gimmick Guide beside What's New, Licenses and the Legal rows.
3. `03-editor-read-aloud-and-bible.png`: Read-Aloud bar and Story Bible popover beside the peek card.
4. `04-trash-danger-and-privacy-optin.png`: danger-red Trash actions beside Privacy & integrity (crash reports off, Help & Legal).

## 6. Blockers / open decisions

- **Launch CI:** needs `EXPO_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN` / `ORG` / `PROJECT` to upload source maps. Without them the build works but reports nothing. Recommend an EU project with IP storage turned off.
- **Native crashes are not reported**, which keeps the zero-PII guarantee. Turning NDK reporting on later first needs a native-side scrubber.
- **Legal links:** with no Publish API URL set, they fall back to `https://read.imaginationengine.app`. Confirm that host serves the Worker's `/legal/*` pages.
- **Gate 3 device checks:** Escape closes Find on hardware keyboards; no landscape extract box; Read-Aloud stops in background; RNSentry JNI 16 KB; keep 06A's `enableOnBackInvokedCallback` removal (06A supersedes this brief).
