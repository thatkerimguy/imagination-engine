# HANDOFF-04 — Google Play UGC Compliance, Rate Limiting, `og:image`, Verified App Links & D-03 Polish

- **Branch:** `feat/dir-04-ugc-applinks` off `main` @ `50b0651` (D-03 merged as #8). `packages/core` untouched.
- **Workers:** Opus 5.5 main ran the contracts, all of `apps/writer`, the smoke/shot scripts, prebuild, and the `og:image` perf
  pass. Sonnet worker 1 built `apps/publish-api`. Sonnet worker 2 built `apps/reader`. `@qa-runner` (Haiku) ran the final sweep.

## 1. UGC Compliance & Rate Limiting

- **Writer ToS gate:** `publish/publish-settings.ts` adds `CURRENT_TOS_VERSION = '2026-11'`, `TosConsent { tosAcceptedVersion?, tosAcceptedAt? }`,
  `hasAcceptedCurrentTos()`, `loadTosConsent` / `acceptCurrentTos` (key `setting/publish-tos`) and `termsUrl(config)` → `<apiUrl>/legal/terms`.
  - `PublishTosGate.tsx` lists prohibited content (hate, harassment, illegal / non-consensual incl. minors, spam, copyright). It says
    chapters are public by URL, that reported work can be taken down, and that authors can unpublish anytime. It links the full Terms online.
  - **No skip:** `Accept Terms & Continue` stays disabled until the consent toggle is on. `Publish now` stays disabled while
    `tosAccepted !== true`, and `use-publish.publish()` re-checks the stored consent before any network call.
  - A version bump re-gates every author. Unpublish is never gated.
- **`POST /api/reports`:** public, JSON or form-urlencoded (8 KB cap), validated (`novelSlug`, optional `chapterSlug`, `reason` enum, `details` ≤ 1000 chars).
  - Unknown slug → 404. Otherwise the report is stored in `reports/pending/<ts>-<uuid>.json` and the route answers 201 `{ok, reportId}`.
  - The record has no raw IP, only a 16-hex SHA-256 prefix. `reports/` and `takedowns/` are never publicly readable (the public route serves `novels/*` only).
- **Moderation (`MODERATION_TOKEN`, separate from `PUBLISH_TOKEN`):** uses the constant-time `tokenMatches`. Unset → 503; wrong or publish token → 401.
  - `GET /api/moderation/reports` lists pending reports.
  - `POST /api/moderation/takedown {novelSlug, reason, reportId?}` writes the tombstone `takedowns/<slug>.json`, deletes `novels/<slug>/*`, de-lists the slug from `index.json`, and moves the report to `reports/resolved/`.
  - After a takedown: `/novels/<slug>/*`, `/share/<slug>` and `/og/<slug>.png` answer **410 Gone**, and author re-publish (`PUT`) is **blocked with 410**
    until `DELETE /api/moderation/takedown/<slug>` clears the tombstone (documented in `apps/publish-api/README.md`).
- **Legal pages:** `/legal/terms`, `/legal/privacy`, `/legal/takedown` are zero-JS, responsive, light/dark, and served with
  `CSP: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'` + `nosniff`.
  - `/legal/takedown` is a working HTML report form that posts to `/api/reports` (escaped `?novel=` prefill). It gives Play reviewers a live moderation URL.
- **Rate limiting:** `wrangler.toml` declares GA `[[ratelimits]]` bindings: `REPORT_LIMITER` 5 req/60 s (ns 1001) and `PUBLISH_LIMITER` 30 req/60 s (ns 1002).
  - `rate-limit.ts` calls `RateLimit.limit({ key })` when both bindings exist. Otherwise it falls back to an in-memory fixed-window limiter, used by `local-server.ts` and the tests.
  - The key is `CF-Connecting-IP`, then `X-Forwarded-For`, then `anon`. Exceeded → `429` + `Retry-After: 60` + JSON error.
  - The publish bucket guards `PUT`/`DELETE /api/novels/:id`; the report bucket guards `POST /api/reports`.
- **Reader Report abuse** (published builds only): shown when the build has a publish-API novels base (`VITE_NOVELS_BASE_URL` ending
  `/novels/`, or `VITE_REPORT_API_URL`). It is hidden in every Writer preview flavour (`opts.preview`, `?preview=1`, `data-preview`).
  - It appears in the chapter footer and, so it is reachable mid-chapter, in the `Aa` drawer. Both buttons are 48 px tall.
  - `views/report-modal.ts` is loaded only via `await import()` on click. It builds its DOM with `h()` and `textContent` (zero `innerHTML`), takes a reason plus optional details,
    and shows clear 201 / 429 / 404 / error copy. Escape or backdrop closes it; it has a focus trap and focus restore, and removes all listeners, nodes and styles on close.

## 2. Dynamic `og:image`, Share Route & App Links

- **`GET /og/:slug.png`** (`og-image.ts` + `png.ts`, pure TS, no native deps): a 1200×630 **indexed-colour PNG** with signature, IHDR, PLTE (128 colours),
  zlib IDAT via `CompressionStream('deflate')`, CRC32 and IEND. The background is a dark tint of the novel accent (`accentColor` → `theme['--accent']` → default),
  with an accent bar and slug-seeded concentric rings + diagonal bands. There is no text; the title is carried by `og:title`.
  - I did a perf pass after the worker: rings became per-row spans (no per-pixel `sqrt`), and the format went from RGB to palette.
    Render went from ~23 ms to ~6 ms, encode from ~40 ms to ~12–22 ms, and size from 46 KB to 29 KB. End-to-end it measures ~12 ms min on a warm Node run;
    the median was noisy because the QA sweep was loading the CPU, so the `< 20 ms` target is met on a quiet machine but not guaranteed.
  - Headers: `image/png`, `Cache-Control: public, max-age=3600`. Unknown slug → 404, taken down → 410.
  - The card is always generated, never the uploaded cover, so every platform gets a consistent PNG.
- **`GET /share/:slug`** (alias `/r/:slug`): `og:title`, `og:description` (subtitle · `~N min read` at 220 wpm · `Interactive Chapter`),
  `og:image` (absolute `/og/:slug.png`, 1200×630), `og:type=book`, `og:url`, and `twitter:card=summary_large_image`.
  - It meta-refreshes and links to `<PUBLIC_READER_URL>/?novel=<slug>`, or shows no redirect when that is unset.
  - Every dynamic value goes through `escapeHtml` (`& < > " '`). The XSS test publishes a `</title><script>` title and an `"…<img onerror>` subtitle and asserts both come out inert.
- **`/.well-known/assetlinks.json`:** `ANDROID_PACKAGE` (default `dev.kinetic.writer`) + `ANDROID_SHA256_CERT_FINGERPRINTS` (comma-separated;
  64-hex with or without colons, normalised to `AA:BB:…`, invalid ones dropped). Unset → `[]`. Statement: `relation: ["delegate_permission/common.handle_all_urls"]`,
  `target.namespace: "android_app"`. Served with `application/json` and `max-age=3600`.
- **Writer App Links:** `plugins/android-app-links.js` (wired through `with-android-release.js`) adds the `autoVerify` intent filter for `https://<host>/share/*`
  and `/r/*`, where host = `process.env.KN_APP_LINK_HOST || 'read.imaginationengine.app'`.
  - **Swap:** set `KN_APP_LINK_HOST` when running `expo prebuild` or an EAS build.
  - `src/app/+native-intent.tsx` → `appLinkRedirect()` (pure, tested) rewrites share links to `/open?novel=<slug>`. `src/app/open.tsx` opens
    the local novel's Outline if this device has it, else the Library. Malformed links go to the Library; other paths are untouched.
- **Prebuild** (`npx expo prebuild --platform android --clean --no-install`), from `android/app/src/main/AndroidManifest.xml`:

```xml
<intent-filter android:autoVerify="true" data-generated="true">
  <action android:name="android.intent.action.VIEW"/>
  <data android:scheme="https" android:host="read.imaginationengine.app" android:pathPrefix="/share/"/>
  <data android:scheme="https" android:host="read.imaginationengine.app" android:pathPrefix="/r/"/>
  <category android:name="android.intent.category.BROWSABLE"/>
  <category android:name="android.intent.category.DEFAULT"/>
</intent-filter>
```

The same prebuild still has `targetSdkVersion=36`, `enableOnBackInvokedCallback="true"`, `allowBackup="false"`, and `KnInputModule`/`KnInputPackage`.

## 3. Directive 03 Polish

- **F1 Outline labels:** `modules/registry.ts` → `moduleOutlineLabel(id, props)` = module name + card detail with its emoji stripped (e.g. `Ambient Bed · Rain`,
  `3D Dice Throw · 2× D6 · …`). It falls back to the raw id only for unregistered modules. It is used by `outlineEntries` (Outline sheet + tablet Reference pane)
  and tested in `outline.test.ts`. The tablet pack asserts that no raw ids show.
- **F2 Calm Mode drawer:** when Calm Mode is On, the `settings-spectacle` / `settings-sound` sections get `.kn-overridden` (opacity .45) +
  `aria-disabled="true"`. The controls stay operable, and full opacity returns as soon as Calm Mode turns Off (the drawer re-renders on every change).
  Asserted in `smoke-publish.mjs` and `writer-shots-tablet.mjs`.

## 4. Verification Sweep (`@qa-runner`)

- **`pnpm check`** (27 s): typecheck ×3 ✅, ESLint 0 warnings ✅, Vitest **73 files / 799 tests**.
  - The first run had 1 failure: the timing-flaky `search-index.test.ts` ("< 50 ms", got 50.9 ms under load). It is untouched by this branch, and the rerun passed 799/799 in 4.9 s.
  - After the `og:image` perf pass: `apps/publish-api` 38/38 and `pnpm typecheck` ✅.
- **`pnpm build` + `bundle-report.mjs`:** reader initial JS **19.4 KB gz** (main 6.7 + module-host 12.7), within the ≤ 19.6 / 20.0 KB target.
  The lazy **`report-modal` chunk is 1.7 KB gz**; its CSS is injected from the chunk.
- **`node scripts/smoke.mjs`:** every tier prints `No leaks after 20 runs` (high: new GL contexts 0, overlay nodes 0); exit 0.
- **`pnpm writer:export` + `writer-shots.mjs --shots qa-shots-dir04`:** 99 ✅ / 2 ❌. The ToS gate (7), Report abuse (8, incl. 201 + moderation queue) and Calm Mode (2)
  checks all passed, with 0 console/page errors in every pack.
  - Both ❌ came from the D-03 tablet check `Library grid … card tops []`. It measured the cards before the Library had loaded.
    The fix waits for `novel-card-vertical-slice`; a standalone rerun of `writer-shots-tablet.mjs` was all ✅ (`3 covers in one row`).
- **`packages/core`:** `git diff 0246947..HEAD -- packages/core` is empty, and so is the working-tree diff.

## 5. Captured QA Screenshots (`qa-shots-dir04/`, git-ignored)

1. `qa-shots-dir04/01-publish-tos-gate.png` — Publish sheet, ToS gate, consent toggle off, `Publish now` disabled.
2. `qa-shots-dir04/02-reader-report-abuse-modal.png` — published reader, lazy Report abuse dialog open (Spam selected).
3. `qa-shots-dir04/03-tablet-outline-human-labels.png` — tablet split pane, Outline with module titles.

Earlier packs (04A, D-03 tablet incl. the Calm Mode dimmed drawer, publish E2E) and `og-card-sample.png` are in `qa-shots-dir04/regression/`.

## 6. Pre-Launch Operator Config Checklist & Open Decisions

- `wrangler secret put MODERATION_TOKEN` (long random; moderators only; never the same as `PUBLISH_TOKEN`).
- `ANDROID_SHA256_CERT_FINGERPRINTS` = the **Play App Signing** key SHA-256 (Play Console → App integrity), plus the upload key if
  sideloaded builds must verify too. Comma-separated.
- `PUBLIC_READER_URL` = the public reader origin, so `/share/:slug` redirects into it. `ANDROID_PACKAGE` stays `dev.kinetic.writer` unless the package changes.
- Replace the placeholder `namespace_id` values `1001` / `1002` in `[[ratelimits]]` with unique account-level ids.
- Final `KN_APP_LINK_HOST`: set it at prebuild/EAS build time. That host **must** serve this Worker's `/.well-known/assetlinks.json` and `/share/*` over HTTPS.

**Open questions**

1. Should the App Links host (`read.imaginationengine.app`) route to the publish Worker (custom domain or route for `/.well-known/*`, `/share/*`, `/r/*`, `/og/*`),
   with the reader served elsewhere? Or should the reader origin proxy those paths?
2. Who receives moderation alerts? Today reports sit in R2 until someone polls `GET /api/moderation/reports`; Play expects timely action.
3. Should the legal copy (Terms/Privacy, version `2026-11`) get a legal review and an operator contact email before submission?
