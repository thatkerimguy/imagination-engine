# HANDOFF-06 — Gate 2 / D-05 fixes, Onboarding, Help Hub, Author QoL, Privacy-First Observability

Branch `feat/dir-06-onboarding-qol-observability` (off `main` @ `d10d0a5`, which contains HANDOFF-05 `562e0c6`).
Main session ran Phase A, E and integration. Two `builder-sonnet` workers built `src/onboarding` + `src/help` and
`read-aloud` / `story-bible` (disjoint files). `qa-runner` ran the final sweep.

## 1. Gate 2 & Directive 05 fixes

- **A1 Cover media in workspace `.zip`.** New `backup/archive-covers.ts` (pure) and `media/cover-archive.ts`
  (expo-file-system; the `.web.ts` version is a no-op).
  - **Pack:** writes every `file:` cover referenced by `meta/item/*` (+ `.thumb.jpg`) to `covers/<basename>`.
  - **Restore:** checks each name against `^[A-Za-z0-9][A-Za-z0-9.-]*\.(jpe?g|png|webp)$`, with no `..`, a cap of
    8 MB per file and 400 files. It writes into this device's `Paths.document/covers/` and rewrites `meta/item/*`
    `coverUri` to the new local URI. Thumbnails keep their sibling name, so `thumbUriForCover` resolves.
  - **Tests:** round-trip with cover bytes, rewritten URIs and Doctor `[]`; a traversal / non-image / oversize test.
- **A2 Sidecar purge.** `sidecarKeysOf(id)` now covers `meta/item`, `meta/chapter-styles`, `meta/publish`,
  `versions/{chapter,novel,doc,folder}:id`, `growth/{chapter,novel,doc,folder}:id` and `trash/`. Regression tests:
  note + growth + meta → Trash → Empty trash gives **Doctor 0 findings**. Book + chapter/novel growth → delete
  forever also gives 0 findings.
- **A3 `.knbook`.** `packNovel` drops trashed seasons and chapters and their sidecars. Workspace backups still carry
  `trash/*` (tested).
- **A4 Danger red.** `Delete forever` and `Empty trash` use `ActionButton variant="danger"` (dangerSoft surface,
  danger ink, `trash-2` icon), the same token family as `Reset demo novel`. A shot gate asserts the danger surface.
- **A5 Android Escape.** `KnInputModule.dispatch` forwards plain `KEYCODE_ESCAPE` (ACTION_DOWN, no modifiers) as
  `{key:'Escape', ctrl:false}` over `knShortcut` and returns `true`. JS maps it with the pure `nativeKeyInput()` to the
  existing `escape` shortcut. `shortcuts-native.test.ts` asserts the generated Kotlin plus the JS mapping.
  Not yet verified on a device (Gate 3).
- **A6.** `disableFullscreenUI` is set on `RichProseInput` (every prose and dialogue body, editor and notes), the
  dialogue speaker field and the note title.

## 2. Onboarding, Help Hub & Author QoL

- **Welcome tour** (`onboarding/`):
  - `setting/onboarding {completedAt?, dismissedAt?}` and a pure `shouldShowOnboarding`. The tour shows only when
    the demo novel is the only book and the tour was never dismissed or completed.
  - `OnboardingLauncher` sits in the Library. 3 steps with Skip always in the header:
    1. "Open Live Preview" (Chrome Tide · Snake Eyes).
    2. Inline cue cards.
    3. New novel / Import .docx·.md·.txt (into Notes) / Restore backup, plus the SAF-folder heads-up.
  - Can be replayed from Help. All regression gates seed "dismissed" (`skipOnboarding` in `scripts/lib`). The Dir-06
    shot uses its own clean context.
- **Help & Legal** (`app/help.tsx`, `help/*`, row with `help-circle` in Settings › Privacy & integrity):
  - The Gimmick Guide is generated from `writerModules`: all 6, with the Feather icon and accent by genre and the
    trigger hint by render layer.
  - Markup reference, `ShortcutsSheet`, "Replay welcome tour".
  - Cards for Backup / 30-day Trash / EPUB 3 / Publishing, and What's New v1.0.
  - Licenses sheet: SIL OFL 1.1 fonts plus MIT/Apache packages.
  - Privacy and Terms summaries; `/legal/{terms,privacy,takedown}` links built from the Publish API URL; a Doctor row.
- **Read-Aloud** (`expo-speech ~58.0.4`). Its manifest adds only a `<queries>` entry for `TTS_SERVICE`; there are
  **0 new permissions**.
  - The pure `read-aloud.ts` controller has segments (gimmicks via `gimmickLines(…,'transcript')`), speeds
    0.85/1/1.25/1.5×, prev/next, and pause implemented as stop-and-remember. The adapter is injectable
    (`speechSynthesis` on web, otherwise a no-op).
  - `ReadAloudBar` is opened from ⋯ › "Read aloud" (`volume-2`).
  - It stops on unmount, on screen blur and when `AppState !== 'active'`. The bar is mounted only while reading.
- **Story Bible.**
  - Pure `story-bible.ts`: the `@query` token at the caret (emails ignored), title matching, `extractMentions`,
    `insertMention` and plain excerpts. `story-bible-source.ts` lists only non-trashed notes, with folder paths.
  - In the editor: typing `@` in prose or dialogue opens the popover, as does ⋯ › "Story Bible" (`book-open`).
  - Each row can insert `@Title` (and moves the caret) or open the read-only peek Sheet, which has "Open full note".
- **10,000-word perf:**
  - `analyzeDocument` caches stats per block in a `WeakMap` keyed on block identity. Edits replace only the edited
    block object, so one keystroke re-tokenises one block. The result is exactly equal to a cold run (tested).
  - `ChapterBlocks.tsx` adds memoized rows that own their `onLayout`, so siblings skip rendering. Handlers were
    already stable through a ref.
  - The stream stays a `ScrollView`. Metrics are still throttled at 250 ms.
  - **Bench (250 blocks / 10,001 words): replacing one block plus the live-metrics recompute takes ≈ 1.1 ms**,
    down from ≈ 16 ms uncached on the same machine. The gate is < 16 ms.

## 3. Privacy-first observability & redacted diagnostics

- **`observability/`:**
  - `CrashReporterPort` (`init`, `disable`, `captureException`, `setRouteSegments`) is composed with a local-only
    ring buffer of the last 20 scrubbed errors.
  - `sentry-adapter.ts` uses **`@sentry/react-native` 8.28.1** (native `sentry-android` 8.57.0); the `.web.ts`
    version is a no-op. The SDK is `import()`ed lazily.
  - Sentry initialises only after the first frame, only when `crashReportingEnabled === true` (the default is
    **false**), and only when `EXPO_PUBLIC_SENTRY_DSN` is set. Toggling it off calls `Sentry.close()`.
- **Zero-PII rules** (`scrub-event.ts`, 9 tests). The scrubber rebuilds each event from an allow-list rather than
  stripping fields:
  - Kept: error type, a sanitised value, frames as basename/function/line/col/in_app, OS name/version,
    app version/build, the `route` tag, and sdk/debug_meta.
  - Dropped: user, request, extra, device, tags, everything else.
  - Values are redacted for quoted text, paths, URLs, emails, `Bearer` tokens, `key=` and long ids.
  - `beforeBreadcrumb` keeps only our own `kn.route` crumbs.
  - SDK options: `sendDefaultPii:false`; screenshots, view hierarchy and threads off; replay at 0; tracing at 0;
    every auto-breadcrumb, console-log and failed-request capture off. The Breadcrumbs, HttpClient, DeviceContext,
    Replay and ReactNavigation integrations are filtered out.
  - Native crash handling, NDK and tombstones are **off**, so no event bypasses `beforeSend`.
- **Navigation tracking** uses only `useSegments()` in `useCrashReporting()` at the root layout. Unknown segments
  are masked as `[?]`. `usePathname()` is never used.
- **Local builds without a token.**
  - `plugins/with-sentry-optional.js` applies Sentry's Expo plugin (the Gradle source-map upload) **only** when
    `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` are all set. `metro.config.js` switches to
    `getSentryExpoConfig` under the same condition.
  - `@sentry/cli`'s binary-download postinstall is set to `allowBuilds: false` in `pnpm-workspace.yaml`.
- **Diagnostics:**
  - `diagnostics/redact-report.ts` (4 tests) reports the app version, platform and OS, registry-known module ids,
    entity counts, backup age, external-folder linked, crash opt-in, and local crash types.
  - Doctor findings appear as `repair@area` codes with severity ×count. There are no keys, ids, titles, URLs or
    filenames.
  - `doctor.tsx` gains "Export diagnostic report", which writes a `.txt` via `deliverText`.

## 4. Prebuild & verification sweep

- **Build:**
  - `expo prebuild --platform android --clean --no-install` succeeded.
  - With `SENTRY_AUTH_TOKEN` / `ORG` / `PROJECT` **unset**, `gradlew :app:processReleaseMainManifest
:app:compileReleaseKotlin` gave **BUILD SUCCESSFUL in 1m 14s** (JDK 17).
- **Merged release manifest:**
  - `targetSdkVersion="36"`, `allowBackup="false"`, `fullBackupContent=@xml/backup_rules`,
    `dataExtractionRules=@xml/data_extraction_rules`, `autoVerify="true"`.
  - **0 restricted permissions.** The full set is INTERNET, ACCESS_NETWORK_STATE (new, from
    `:sentry_react-native`; normal install-time), USE_BIOMETRIC, USE_FINGERPRINT, VIBRATE and
    DYNAMIC_RECEIVER_NOT_EXPORTED.
  - `enableOnBackInvokedCallback` is **absent on purpose**. 06A strips it (RN #58407 back-swipe fix), which differs
    from this brief's checklist; see §6.
- **New `.so` files** (all from Sentry; expo-speech has none):
  - `libsentry.so` and `libsentry-android.so` × {arm64-v8a, armeabi-v7a, x86, x86_64}. The arm64 and x86_64 copies
    **pass 16 KB** (`scripts/lib/elf-align.mjs`, minAlign 16384).
  - RNSentry's own JNI lib (`OnLoad.cpp`, built through CMake) is compiled from source. Gate 3 should check its
    alignment in the APK.
- **`qa-runner` results:**
  - `pnpm build`: reader initial JS **19.4 KB** gz (≤ 20.0), "Bundle budget OK".
  - `pnpm writer:export`.
  - `writer-shots.mjs --shots qa-shots-dir06`: **133 ✅ / 0 ❌**, exit 0. This includes 32 publish-pack gates, zero
    console/page errors and the tablet pack's zero errors.
  - `git diff 0246947..HEAD -- packages/core` is empty. `git diff HEAD -- apps/reader` and
    `git diff d10d0a5 -- apps/reader` are empty.
- **`pnpm check`:** the sweep hit one lint error (an unused `shot` in `writer-shots-dir06.mjs`). After the fix,
  `pnpm check` passed: typecheck ×3, ESLint 0 warnings, **Vitest 88 files / 898 tests (4.5 s)**. The named Dir-06
  suites (archive, trash, onboarding, help-content, read-aloud, story-bible, editor-bench, scrub-event,
  redact-report, shortcuts-native) give 10 files / 68 tests ✅.
- **File limits:** every new or changed source file is ≤ 250 lines (ChapterEditor 248, writer-shots.mjs 249).
  `scripts/smoke.mjs` (268) was already over before this directive and is untouched. No `any`.

## 5. QA screenshots (`qa-shots-dir06/`, git-ignored; older packs moved to `regression/`)

1. `01-onboarding-micro-tour.png`: the Welcome sheet on a fresh workspace (Skip, step dots, Open Live Preview).
2. `02-help-legal-center.png`: the 6-module Gimmick Guide next to What's New, Licenses and the Legal rows.
3. `03-editor-read-aloud-and-bible.png`: the Read-Aloud bar and Story Bible popover, next to the peek card.
4. `04-trash-danger-and-privacy-optin.png`: danger-red Delete forever / Empty trash next to Privacy & integrity
   (crash reports off, Help & Legal).

## 6. Blockers / open decisions

- **Sentry DSN & source maps at launch.** The release CI needs `EXPO_PUBLIC_SENTRY_DSN` plus `SENTRY_AUTH_TOKEN`,
  `SENTRY_ORG` and `SENTRY_PROJECT` so it uploads source maps. Without them the build works but reports nothing.
  Recommend an EU-region project with IP storage disabled server-side.
- **Native crashes are not reported** (NDK and native crash handling are off, so the zero-PII guarantee holds).
  If the Author wants NDK crashes later, they need a native `beforeSend` scrubber first.
- **Legal links fallback.** When no Publish API URL is set, the links fall back to `https://read.imaginationengine.app`
  (the App Link host). Confirm that host serves the Worker's `/legal/*` pages.
- **Gate 3 device checks:**
  - Hardware Escape closes Find on Android.
  - No landscape extract box.
  - Read-Aloud stops on background.
  - 16 KB check on RNSentry's JNI lib.
  - The manifest keeps the 06A `enableOnBackInvokedCallback` removal (that brief overrides this one).
