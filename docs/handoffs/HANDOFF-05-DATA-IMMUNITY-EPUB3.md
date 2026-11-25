# HANDOFF-05 — Data-Loss Immunity (SAF Auto-Backup & 30-Day Trash), EPUB 3, Cover Downscaling & Moderation Webhook

- **Branch:** `feat/dir-05-data-immunity-epub3` off `main` @ `7323ede` (D-04 merged as #9). `packages/core` and `apps/reader` untouched.
- **Workers:** Opus 5.5 main ran `zip.ts` STORE, Trash, SAF backup, covers, the EPUB wiring, QA shots and prebuild. Sonnet worker 1
  built the EPUB serializer (`export/epub*.ts`). Sonnet worker 2 built the publish-api webhook. `@qa-runner` (Haiku) ran the final sweep.

## 1. EPUB 3 & `zip.ts` Verification

- **`zip.ts` STORE:** each entry is `Uint8Array | { data, store?: boolean }` (default DEFLATE).
  - fflate's streaming `Zip` always writes data descriptors, so local headers carry no CRC or sizes.
  - Any archive with a `store` entry therefore uses the new `zip-write.ts`: exact CRC-32 and sizes, no data descriptor, `extraLen 0`. DOCX and backups keep the old fflate path unchanged.
- **OCF proof** (`zip.test.ts`, sync and >50 KB paths): offset 0 local header, method `0`, flags `0`, exact CRC, sizes `20`/`20`, name length `8`, `extraLen 0`,
  bytes 30–37 `mimetype` and 38–57 `application/epub+zip`. `writer-shots` repeats the check on a real browser-downloaded `Chrome-Tide.epub`.
- **Serializer:** `epub.ts` (115 lines), `epub-xhtml.ts` (132), `epub-opf.ts` (99). `buildEpub(book, opts, { cover?, now?, identifier?, language? })`.
  - Entry order: `mimetype` (STORE), `META-INF/container.xml`, `OEBPS/content.opf`, then nav, css, `ch-NNN.xhtml`, plus an optional `cover.<ext>` + `cover.xhtml`.
  - `content.opf` is EPUB `3.0` with a deterministic `urn:uuid`, UTC `dcterms:modified`, nav `properties="nav"` and `cover-image`.
  - Gimmicks go through `flattenBlocks` / `gimmick-text.ts`. Text is XML-escaped. The CSS never forces ink or background colours, so dark e-reader themes stay intact.
- **EPUBCheck:** `@likecoin/epubcheck` **does not exist on npm (404)**. `@likecoin/epubcheck-ts@0.7.1` (a pure-TS port) runs under Vitest instead.
  - Test book: 3 chapters, inline marks, dialogue, a scene break, `& < > " '`, all 6 gimmicks and a PNG cover.
  - Result: **0 fatal / 0 error / 0 warning / 0 info**. The test also checks well-formedness, manifest hrefs, spine idrefs and determinism.
- **Compiler:** `ExportFormat` gains `'epub'`. `ExportGrid` shows an **EPUB 3** tile ("E-reader book", Feather `book`) right after DOCX.
  - `export-book.ts` reads the cover via `readCover` and delivers `application/epub+zip`. An unreadable cover is skipped.

## 2. SAF Auto-Backup & 30-Day Trash

- **Persistence:** `expo-file-system/legacy` `StorageAccessFramework.requestDirectoryPermissionsAsync()`.
  - Verified in SDK 58 `FileSystemLegacyModule.kt`: its `OnActivityResult` calls `contentResolver.takePersistableUriPermission(treeUri, READ|WRITE)` on the `ACTION_OPEN_DOCUMENT_TREE` grant.
  - The tree URI therefore survives restarts and reboots with no `SaveFileModule` helper.
  - Uninstall drops the grant but the files stay. After reinstall the Author re-picks the folder and restores.
- **Mirror (`saf-mirror.ts`):** avoids the `#42273` streaming bug.
  - The archive is finalized in memory, written first to the app-private `backups/emergency-*.zip`, then written in one base64 call as `kinetic-writer-auto-YYYYMMDD-HHmm.zip`.
  - **Keeps the newest 5.** Pruning only matches `^kinetic-writer-auto-\d{8}-\d{4}( \(n\))?\.zip$`.
  - Runs on scheduled `maybeAutoBackup` and on "Back up now". A revoked or unmounted folder is recorded in `lastSafMirrorError`. The local snapshot is always kept.
  - Web build: a silent no-op.
- **UI (`BackupSection.tsx` + `ExternalFolderRow.tsx`):**
  - `backupFreshness()` badge over `relative-time.ts`: "Backed up just now", "Backed up 4 minutes ago" or "Not backed up yet"; it turns warm after 7 days.
  - **External backup folder (survives uninstall):** Choose / Change / Disconnect plus the last mirror status. Shows an Android-only note on web.
  - "Export a .zip copy" when a folder is connected.
  - The HANDOFF-02 device-transfer note.
  - **Trash · N items** row.
- **Trash model:** core is frozen, so `deletedAt` (ISO UTC) lives in a writer-only `trash/<id>` record `{ kind, title, novelId?, seasonId?, index? }`.
  - Seasons and chapters are unlinked from their parent order, with the index remembered, so outline, compile, publish and search skip them for free.
  - `listNovels`, `summarizeNovel` and `RecentStrip` skip trashed books and chapters.
  - `listAllFolders`, `listAllDocs` and `listChildren` hide trashed notes and anything inside a trashed folder (cycle-safe). That covers NotesWorkspace, search, compile and ReferencePane.
  - `trash/` is included in workspace backups.
- **Move to Trash** replaces delete in four places, each with a calm `ConfirmDialog` that carries the restore hint:
  - Library book card;
  - Notes ⋯ menu;
  - Outline chapter and season menus (a book's only season can't be trashed: core needs ≥1);
  - Chapter Editor ⋯.
- **Ops (`trash.ts`):** `moveToTrash`, `listTrashedItems`, `restoreTrashedItem`, `permanentlyDeleteItem`, `emptyTrash` and `purgeExpiredTrash(now)`.
  - **Restore** returns an item to its old index. A trashed book or season comes back with it; a missing folder puts the note at the Notes root.
  - **Permanent delete** removes the item's data, its children, sidecars and nested trash records. It returns only cover URIs nothing else uses; their files and thumbnails are deleted.
  - **Purge:** anything 30 days old or more, run once per launch in `RepositoryProvider`.
- **Doctor:** trashed seasons and chapters are no longer `orphan-*`. A stale `trash/<id>` record shows up as `orphan-sidecar` (info).
- **Screen:** `app/trash.tsx` lists each item with a kind badge and glyph and "Deletes in N days". Restore is one tap. Delete forever and Empty trash both confirm first.
- **Tests:** `trash.test.ts` (10): hidden from outline, search, compile, publish and counts; intact in-place restore; chapter restore with its trashed season and book; nested notes; 29-day kept vs 31-day purged; full wipe leaves no keys; Doctor clean.
  `saf-mirror.test.ts` (4): naming, labels, keep-5 without touching other files, freshness, settings clear.

## 3. Cover Downscaling & Moderation Webhook

- **`expo-image-manipulator ~58.0.16`**, added via `npx expo install`. Expo and RN were not upgraded.
- **Targets (`cover-resize.ts`, tested):** cover fits inside **1200×1800** at JPEG 0.84 (`covers/<id>.jpg`); thumbnail **240×360** at JPEG 0.80 (`covers/<id>.thumb.jpg`). Never upscales.
  - If resizing fails, the original is copied as before. Web keeps its data-URI path in `pick-cover.web.ts`.
- **Display:** `CoverImage.tsx` tries the thumbnail, then the full cover (legacy covers), then the monogram. Used by `BookCoverThumb` (via `NovelSummary.coverUri`) and `NoteRow`.
  - Doctor never scans `covers/`, so `.thumb.jpg` sidecars are never flagged. They are deleted with their cover.
- **Webhook:** optional `MODERATION_WEBHOOK_URL`. After a 201 on `POST /api/reports`, the worker calls `ctx.waitUntil(notifyModerationReport())`, or fires a detached promise when there is no ctx.
  - Payload: `content`/`text` (Discord or Slack), `reportId`, `novelSlug`, `chapterSlug?`, `reason`, `detailsPreview` (≤240 characters), `createdAt`. **No IP or ipHash.**
  - 5 s timeout; all errors are caught. `README.md` documents `wrangler secret put`. `local-server.ts` sets no URL.
- **New `.so` binaries: none.** `expo-image-manipulator` is Kotlin-only, with no CMake or NDK.

## 4. Prebuild & Verification Sweep (`@qa-runner`)

- **Prebuild** `--platform android --clean --no-install` is clean. `gradlew :app:processReleaseMainManifest :app:compileReleaseKotlin` **BUILD SUCCESSFUL** in 1 min 55 s.
- **Merged release manifest:**
  - `targetSdkVersion="36"`, `enableOnBackInvokedCallback="true"`, `allowBackup="false"`, backup XML rules, `autoVerify="true"`.
  - Permissions: INTERNET, USE_BIOMETRIC, USE_FINGERPRINT, VIBRATE and the dynamic receiver.
  - **0** MANAGE_EXTERNAL_STORAGE / READ_MEDIA_IMAGES / CAMERA / RECORD_AUDIO / SYSTEM_ALERT_WINDOW. `READ_MEDIA_IMAGES` is also added to `blockedPermissions`.
- **`pnpm check`:** PASS in 26 s. Typecheck ×3, ESLint 0 warnings, **79 files / 834 tests**. All 8 named suites green (61 tests).
- **`pnpm build` + `bundle-report.mjs`:** budget OK. Reader initial JS **19.4 KB gz** (main 6.7 + module-host 12.7).
- **`writer-shots.mjs --shots qa-shots-dir05`:** exit 0 in 108 s, **106 ✅ / 0 ❌**, 0 console or page errors across phone, `smoke-publish` and tablet runs.
- **Diffs:** `git diff 0246947..HEAD -- packages/core` and `git diff HEAD -- apps/reader` are both empty. No source file over 250 lines.

## 5. Captured QA Screenshots (`qa-shots-dir05/`, git-ignored)

1. `01-compiler-epub-option.png`: export grid with the **EPUB 3** tile beside DOCX.
2. `02-settings-saf-backup-card.png`: the backup badge, Back up now, External folder, transfer note and `Trash · 1 item`.
3. `03-trash-screen-restore.png`: the "Snake Eyes" chapter showing `Deletes in 30 days`, Restore, Delete forever and Empty trash.

## 6. Test Gate 2 Focus Notes & Open Decisions

Check on the **Android 16 emulator** (D-03/04/05):

1. Settings IME reveal.
2. Light-theme 3-button nav icons.
3. `Meta+/` sheet and Ctrl+B/I/Z/F.
4. `pm get-app-links` shows `verified` (`autoVerify`).
5. EPUB 3 with a cover opens in Play Books or ReadEra: cover, TOC, dialogue, gimmick transcripts, dark theme.
6. External folder:
   - Pick `Documents/ImaginationEngine`, back up, reboot; the next auto-backup still mirrors.
   - **Uninstall, reinstall, re-pick the folder, restore the newest `kinetic-writer-auto-*.zip`.**
   - Revoke access: the error shows and the local snapshot remains.
7. Import a cover ≥4000 px: the stored cover is ≤1200×1800 and the thumbnail 240×360. Check `dumpsys meminfo` with a large library.
8. Re-run the 16 KB ELF check (`verify-android-artifact.mjs`); no new `.so` files are expected.
9. Trash a book, a chapter and a note; restore each, then empty Trash. Doctor stays clean.

**Open decisions:**

1. `.knbook` export still packs trashed chapters, which arrive as orphans Doctor can attach. Should they be excluded?
2. With a folder connected, "Back up now" skips the picker. Is "Export a .zip copy" enough?
3. Should the Java EPUBCheck also run once at release time?
