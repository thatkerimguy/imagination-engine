# Phase 2B-2 Report — Workspace, Exports & Security on Folio UI

Directive 02B-2, built on the Phase 2C Folio baseline (`ee2ae61`). Branch `claude/new-session-zp1pj8`.
Verified at `1e383ab`.

## Verification (single `@qa-runner` sweep)

| Check                                                                       | Result                                                                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` (typecheck root + writer, ESLint 0 warnings, Vitest)           | ✅ 39 files · 533 tests                                                                                                 |
| New/required suites                                                         | ✅ docx 5 · archive 7 · diff 5 · search-index 10 · lock 8 · doctor 8 · workspace 9 · routes 9 · tokens 292 · boundary 9 |
| `pnpm build` + `bundle-report.mjs`                                          | ✅ reader initial JS **18.5 KB** gz (6.1 + 12.4) — unchanged, < 20 KB, ceiling 40 KB                                    |
| `expo export --platform web`                                                | ✅                                                                                                                      |
| `expo export --platform android`                                            | ✅ Hermes bytecode `.hbc`, 4.2 MiB                                                                                      |
| Heavy-import grep (`three`, `cannon-es`) over both exports                  | ✅ none                                                                                                                 |
| `scripts/smoke.mjs`                                                         | ✅ all green, zero console errors                                                                                       |
| `scripts/writer-shots.mjs` (2C pack + 02B-2 workspace pass)                 | ✅ 22/22, zero console errors                                                                                           |
| `packages/core` / `apps/reader` diff since `ee2ae61` (core since `0246947`) | ✅ empty                                                                                                                |
| Max file size in `apps/writer/src`                                          | ✅ 250 (`search/search-index.ts`)                                                                                       |
| `any` in `apps/writer/src`                                                  | ✅ none                                                                                                                 |

## What shipped

**Phase A (orchestrator)**

- 2C polish: metrics ribbon / format strip right padding, one shared “Tap any chart…” caption on
  Growth, Library rows put “Edited just now” on its own line.
- Deps: `fflate`, `expo-print`, `expo-image-picker`, `expo-crypto`, `expo-local-authentication`;
  `NSFaceIDUsageDescription`.
- Sidecars: `store/folders.ts` (+ `note-promote.ts`), `store/item-meta.ts` (8 rail tones, unified
  pinned-first sort), `store/versions.ts` (30-auto ring, 5-min throttle, manual, “Before restore”),
  `store/unlock-session.ts`, `media/pick-cover.ts`.
- Folio 3-tab bar (Library · Notes · Search, 56dp, hairline, accent tint), new routes and
  `parentHref`/`tabForPath` tests.

**Workers**

1. Notes workspace (nested folders, breadcrumbs, colour rails, pin/lock/tag cues, sort popover,
   item ⋯ menu), standalone note editor reusing the chapter editor parts, Recent strip,
   ItemMetaSheet, pure-TS instant search with highlighted excerpts and locked-body redaction.
2. Book compiler (cover, reorderable chapters, Title/TOC/Page-break toggles, Gimmick mode,
   7-format grid), MD/HTML/TXT/DOCX (5-part OOXML via fflate)/PDF/print, .txt/.md/.docx import,
   `.knbook`/`.knchap`/workspace `.zip` backup with validate-before-write restore, auto-backup with
   5 rotating native snapshots.
3. Myers O(ND) diff + Version History sheet, Master Lock (salted SHA-256 via expo-crypto with pure
   fallback, 12-char hashed recovery code, biometric on native, throttling), LockGate /
   ItemLockGate, Document Doctor (scan, quarantine-first repair).

**Phase C (orchestrator)**: EditorSheets split (ChapterEditor 250 → ~220 lines), Version History +
auto-checkpoints in chapter and note editors, Search block deep links, LockGate in the root layout,
ItemLockGate on chapter/note routes, compiler/import/meta in Outline + Notes, BackupSection and
auto-backup, Recent strip on Library, Settings rows for Master Lock and Document Doctor.

## Bugs found in this pass and fixed

- Tapping **Notes** inside a sub-folder stacked a second Notes root → tab re-tap now `dismissTo`.
- PIN-length segment control on lock setup rendered empty (`hug` inside a centred column) → full width.
- Search latency test flaked under full-suite parallel load → best-of-3 timing.

## Choices & known limits (flagged for the Author)

- Master Lock is a privacy lock, not encryption (no SQLCipher in Expo Go); a single salted SHA-256
  PIN hash is brute-forceable by someone with the raw files.
- DOCX omits the cover (5-part package); PDF/HTML include it. Bullets are `• ` text in DOCX.
- Folder compiles have no author line and no `.knbook` option.
- “Manual” sort reads `manualOrder`; there is no drag-to-reorder UI yet.
- New note creates the record immediately, so an abandoned empty note stays listed.
- Version diff shows gimmick blocks as `[Module: <id>]` lines.
- Shots 04 and 05 are two 390×844 frames side by side (compiler top/bottom; lock keypad + doctor).

## Screenshots (attached to the handoff, `qa-shots-phase2b-2/`)

`01-folio-folders-recent` · `02-folio-instant-search` · `03-folio-version-history-diff` ·
`04-folio-book-compiler` · `05-folio-lock-and-doctor`
