# Phase 3 — One-Tap Publish (Directive 03, Milestone 3)

Branch `claude/modest-hypatia-px2t1r`. Commits: `495fbaf` (A), `65727e9` (B1 Worker), `b49c5c5` (B2 client),
`f2e8557` (B3 UI + C integration — the tree the QA sweep verified); this report follows on top.

## What shipped

| Area             | Files                                                                                                   | Notes                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Worker backend   | `apps/publish-api/src/{store,protocol,auth,publish,publish-validate,worker,index,local-server}.ts`      | Cloudflare Worker + R2; self-contained `R2BucketLike` types, zero new npm packages (lockfile: +6 lines workspace link)   |
| Reader feed hook | `apps/reader/src/data.ts`                                                                               | `VITE_NOVELS_BASE_URL` (trailing slash normalized); unset → `./novels/` exactly as before                                |
| Writer client    | `apps/writer/src/publish/{publish-settings,publish-links,publish-client,publish-http}.ts`               | every chapter passes `prepareChapter` before upload                                                                      |
| Writer UI        | `PublishSheet.tsx`, `PublishSettingsCard.tsx`, `use-publish.ts`, `ui-publish-parts.tsx`, `copy-link.ts` | mounted in Settings, Book Outline (`outline-publish` + ⋯ item) and editor ⋯ "Publish…" (autosave flushed first)          |
| Secrets / Doctor | `backup/archive.ts`, `diagnostics/doctor-content.ts`                                                    | `setting/publish-secret` never exported nor overwritten on restore; `meta/publish/<id>` flagged only if the book is gone |
| E2E              | `scripts/smoke-publish.mjs` (+ helpers)                                                                 | real HTTP Worker over the in-memory store; `writer-shots --shots` chains it for the Phase 3 pack                         |

### Lifecycle (matches `apps/reader`)

- **published** → chapter JSON written + listed in `season.chapters`.
- **unlisted** → chapter JSON written, **not** listed (direct link only).
- **draft** → never written; deleted if previously published (stale-key sweep under `novels/<id>/`).
- `novel.seasons` = seasons with ≥ 1 published chapter (falls back to unlisted-only seasons, since the
  schema needs ≥ 1); `novels/index.json` lists the book only while it has ≥ 1 published chapter.
- Every payload is validated with `@kn/core` before any write; `novel.id` must match the URL;
  body ≤ 5 MB, cover ≤ 1.5 MB (jpeg/png/webp → `cover.<ext>`, `cover` added to `novel.json`).

## Subagent breakdown

- **Main (Opus)**: Phase A (scaffold, `ObjectStore` + protocol contracts, reader hook, secret key + Doctor), Phase C
  integration, haptics fix (success buzz now honours the Haptics preference), `writer-shots` split to stay ≤ 250 lines,
  smoke fixes (curtain-title locator ambiguity; wait for the sheet slide-in before shot 02).
- **Worker 1 (Sonnet)**: Worker backend + 18 tests + README. **Worker 2 (Sonnet)**: publish client + 8 tests.
  **Worker 3 (Sonnet)**: Folio sheet/card + `smoke-publish.mjs`. **QA (Haiku)**: full sweep below.

## Verification (single sweep)

| Check                                                   | Result                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                                            | ✅ exit 0 — typecheck (root + writer + publish-api), ESLint 0 warnings, **53 files / 643 tests**                                                                                                                                                                                                        |
| `git diff 0246947..HEAD -- packages/core`               | ✅ empty                                                                                                                                                                                                                                                                                                |
| `any` / file size                                       | ✅ zero `any`; every file in `apps/writer/src` + `apps/publish-api/src` ≤ 250 lines                                                                                                                                                                                                                     |
| `pnpm build` + `bundle-report.mjs`                      | ✅ initial reader JS **18.5 KB gz** (main 6.1 + module-host 12.4) / 40 KB budget — unchanged from 2F; `three` (128.5 KB gz) lazy only; `cannon-es` absent from the initial graph                                                                                                                        |
| `expo export --platform web` / `android`                | ✅ Hermes `entry-*.hbc` **4,541,311 B**; `WebGLRenderer` / `MeshPhysicalMaterial` / `cannon-es` = **0** in `.hbc` and web JS (the 2 "three" byte hits are `…Width` + `three…` and demo prose "three days")                                                                                              |
| `node scripts/smoke.mjs`                                | ✅ zero console errors                                                                                                                                                                                                                                                                                  |
| `node scripts/smoke-publish.mjs`                        | ✅ 15/15 — Connected, token masked, ledger 1/1/1, "Published Chrome Tide" toast, link copied, index lists book, ch01 200, draft ch03 404, unlisted ch02 200 + unlisted, no `{{comment` leaked, reader renders Chrome Tide → Snake Eyes **from the API port**, unpublish → 404, zero console/page errors |
| `node scripts/writer-shots.mjs --shots qa-shots-phase3` | ✅ 4 Phase 3 PNGs + 29 regression PNGs                                                                                                                                                                                                                                                                  |

## Deploy (Cloudflare) — full guide in `apps/publish-api/README.md`

1. `cd apps/publish-api && wrangler r2 bucket create kinetic-novels`
2. `wrangler secret put PUBLISH_TOKEN` (e.g. `openssl rand -base64 32`)
3. `wrangler deploy`
4. `VITE_NOVELS_BASE_URL=https://kinetic-publish-api.<you>.workers.dev/novels/ pnpm --filter @kn/reader build` → deploy `apps/reader/dist` to Pages
5. Writer → Settings → Publishing: API URL, Author token, Public reader URL → **Test connection**.

## Decisions / flags for the Author

- `@kn/core` has no `isValidId`; the Worker uses `isSlugId` (same slug rule as core) since core is frozen.
- No Toast primitive existed: "Published <Title>" is a calm inline banner in the sheet.
- Every publish is a full sync: anything not in the new key set (including a cover no longer set) is removed.
- Covers: `data:` URIs upload today; `file://` covers on native are skipped with a sheet warning (a native
  file reader can be injected via `readCover` later).
- Native "copy link" uses the system Share sheet (no clipboard module installed; zero new native deps).
- Unlisted chapters' "Next" footer in the reader falls back to the first listed chapter (existing reader behaviour).
