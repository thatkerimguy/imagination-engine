# HANDOFF — OVERHAUL-02A: Settings 4-Hub, Compiler 2x4, Entity Labels, 48 dp Audit, EN/TR/ES i18n

Branch `feat/overhaul-02a-ui-i18n-polish` off `main` @ `a1b07d3` (OVERHAUL-02, PR #15, merged).
Main Opus 5.5 (Medium) did Phase A, key locking, screen wiring and the Playwright gates. Two
parallel `builder-sonnet` workers handled disjoint folders: `src/i18n/` (TR/ES) and
compile/teaser/kind labels. `qa-runner` ran the verification sweep.

## 1. Settings 4-Hub Consolidation & 48x48 dp Touch Audit

Root `/settings` (`settings.tsx`, 172 lines) is now four calm `CardGroup` hubs:

| Hub                   | Rows (testIDs)                                                                                                                                                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Writing & Display** | `open-appearance` → `/appearance` · `card-language` (System / English / Türkçe / Español, `settings-language-{system,en,tr,es}`) · `card-workspace` Default workspace (`settings-workspace-{prose,interactive}`, persisted as `AppSettings.defaultWorkspace`, default `'prose'`, used by New Novel) · `card-haptics` |
| **Data & Backup**     | `open-backup` → **`/settings-backup`** · `open-trash` "Trash · N items" → `/trash` · `open-doctor` → `/doctor`                                                                                                                                                                                                       |
| **Publishing & Web**  | `open-publishing` → **`/settings-publishing`**                                                                                                                                                                                                                                                                       |
| **Privacy & About**   | `open-lock` · `settings-crash-reports` (opt-in, OFF by default) · `open-help` · `reset-demo` (danger row)                                                                                                                                                                                                            |

- `/settings-backup` hosts `BackupSection` (all `backup-*` testIDs intact). Its Trash card moved to the root hub.
- `/settings-publishing` hosts `PublishSettingsCard` and the extracted `LivePreviewCard` (Live
  Preview reader source, a developer-only control).
- Both sub-screens render inside `Page`, which wraps `PageScroll`. That is
  `KeyboardAwareScrollView` on native, so the API URL, token and reader URL fields clear the IME.
- Both sub-screens are pushed with `router.push`, have Stack titles, slide in, and use `parentHref()` → `/settings` (route tests added).
- The root holds zero publish/token fields (gated). The publishing card stays rounded and clipped (gated).
- **48 dp audit:**
  - Already compliant: `IconBtn`, `Toggle`, `SegmentControl`, `Stepper`, `FolioTabBar` (56), editor toolbar (`BlockStrip`/`ToolbarCollapse` slop) and `ColorSwatchRow`.
  - **Upgraded to ≥ 48x48 with `hitSlopFor`, visuals unchanged:**
    - compact `ActionButton` (was 36 + 4 + 4 = 44)
    - focus-mode exit pill (was 28 + 8 + 8 = 44)
    - Notes `Breadcrumbs` (32)
    - `ItemMetaSheet` tag chips (32)
    - `KindFilter` pills (32 → slop)
    - `RecentStrip` toggle row (minHeight 36 → 48)
    - Teaser chapter chips (minHeight 48)
  - `a11y.test.ts` asserts `MIN_TOUCH === 48`, that 28/32/36/40/44 dp boxes reach ≥ 48 on both axes, and that each upgrade stays in source.

## 2. Compiler 2x4 Grid, Teaser Picker & Entity Kind Labels

- **ExportGrid:**
  - 8 equal tiles in a 2-column x 4-row grid: DOCX · EPUB 3 · PDF Book · Markdown · HTML · Royal Road · TXT · .knbook.
  - The Royal Road subtitle is now **"Ready to paste"**, with no `numberOfLines` clip, and is gated untruncated at 390 dp.
  - **Copy Royal Road HTML** and **Print** moved into a clipped `card-export-secondary` under "Share & print". There is no 9th tile.
  - TestIDs kept: `export-*`, `export-royalroad-copy`, `export-print`.
- **Teaser chapter picker:**
  - `TeaserChapterStrip` (`teaser-chapter-strip`, chips `teaser-chapter-<id>`) shows only when the sheet opens from Novel Outline on a book with more than one non-trashed chapter.
  - It defaults to the first quotable chapter, and switching chips re-seeds the quote.
  - Pure `showChapterPicker` / `teaserChapterChoices` / `defaultTeaserChapterId` have tests in `teaser-model.test.ts`.
- **Kind labels:**
  - New `src/ui/node-kind.ts` holds `NODE_KIND_META` for book, season, chapter, folder, note, character, location and lore: a `kind.*` label key plus a Feather icon (character → `user`, location → `map-pin`, lore → `book-open`).
  - `notes/kind-meta.ts` reuses it.
  - Recent tiles carry `docKind` (pure `recent-items.ts`).
  - Trash records carry `docKind`.
  - Search doc hits show the kind glyph and a "Character · Notes / …" subtitle.
  - Tests: `node-kind.test.ts`, `recent-items.test.ts`, `trash-kinds.test.ts`, `search-index.test.ts`. The Playwright gate checks that Recent and Trash read Character / Location / Lore and never "Note".

## 3. Complete en / tr / es i18n

- **351 keys per locale, en = tr = es.** Each locale is split by domain, and every file is ≤ 250 lines:
  - `en-core.ts` (129), `en-screens.ts` (134), `en-content.ts` (146) → `strings-en.ts`
  - `tr-core` / `tr-screens` / `tr-content` → `strings-tr.ts`
  - `es-core` / `es-screens` / `es-content` → `strings-es.ts`
  - Largest locale file: 149 lines.
- Turkish and Spanish are typed `Record<StringKey, string>`, so a missing key is a compile error.
- `Locale = 'en' | 'tr' | 'es'`. In `'system'` mode, `tr*` resolves to tr, `es*` to es, and anything else to en.
- New typed plural helper `tn(base, n)` (`PluralBase` = keys with `.one`/`.other`), also exposed by `useI18n()`.
- **Parity proof:** `i18n-parity.test.ts` + `i18n.test.ts` (24 tests) check:
  - runtime key equality across all three locales
  - an identical `{{placeholder}}` set for every key in tr and es
  - no empty strings
  - tab labels ≤ 10 chars; `compile.fmt.*` ≤ 22 and Royal Road ≤ 16 chars
  - `resolveLocale` for `tr`, `tr-TR`, `es-MX` and `fr-FR`
  - `formatNumber(12345,'tr') === '12.345'`
  - en/tr/es plurals
- **Closed:**
  - Gate 3 Bug 2: RecentStrip (header, a11y, kind subtitle, relative time), Library card counts ("1 sezon · 1 bölüm · 118 kelime") and the `<Title> options` a11y label.
  - Settings hubs, `BackupSection` / `ExternalFolderRow`, `PublishSettingsCard`, Live Preview.
  - Book Compiler, Trash / TrashRow, Notes (filters, create menu, sort, empty states, item menu), Backlinks ("Referenced in {{count}} place(s)").
  - New Novel and Novel Settings (section names, Classic / Interactive modes), Document Doctor, TeaserSheet, Search, Help headings, Stack titles.
- **0 px horizontal overflow** is gated for Türkçe Library and for Español Settings + Book Compiler. All `testID`s are locale-invariant.
- **Known gaps (flagged, not in the brief's list):**
  - Help body paragraphs (`help-content.ts`) stay English; only the headings are translated.
  - Note editor chrome (NoteTopBar undo/redo, NoteEditor overflow menu) stays English.
  - Stored section labels stay English values (Season / Volume / Arc) and are translated only for display.

## 4. Verification Sweep

| Gate                                                              | Result                                                                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                                                      | PASS: typecheck x3 clean, ESLint 0 warnings, **108 files / 1056 Vitest tests**, about 23 s                                                              |
| `pnpm build` + `bundle-report.mjs`                                | PASS: reader initial JS **19.5 KB gz** (6.7 + 12.8) ≤ 20.0 KB                                                                                           |
| `writer:export` + `writer-shots.mjs --shots qa-shots-overhaul02a` | PASS, exit 0: **172 ✅ / 0 ❌** (phone 127, `smoke-publish` 32, tablet 13), including the 12 OVERHAUL-02A gates; zero console/page errors in every pack |
| `git diff a1b07d3 -- packages/core apps/reader`                   | empty                                                                                                                                                   |
| `package.json` / `apps/writer/package.json` / `pnpm-lock.yaml`    | unchanged; no native/Gradle/manifest changes                                                                                                            |
| Max touched file                                                  | 250 lines (`search/search-index.ts`); none over                                                                                                         |

Gate script updates:

- `smoke-publish`, `4a`, `2d` and `2f` reach Live Preview and Publishing through `/settings-publishing`.
- `dir05` reads Trash from the root, then makes 1 tap into Backups. `dir06a` makes 1 tap into Publishing for the clipped Test connection check.
- OVERHAUL-01/-02 shots moved to `regression/`.
- The new `writer-shots-overhaul02a.mjs` is chained from `writer-shots.mjs`.

Note: Playwright resolves from the global npm root on this machine. Run the shots with
`NODE_PATH=%APPDATA%\npm\node_modules`, as the qa-runner sweep could not find it otherwise.

## 5. Captured QA Screenshots (`qa-shots-overhaul02a/`, git-ignored)

1. `01-settings-4-hubs.png`: the 4-hub root beside the Web Publishing & API sub-screen
2. `02-compiler-2x4-grid.png`: the 2x4 grid, "Ready to paste", and the Share & print card
3. `03-recent-trash-entity-labels.png`: Recent and Trash with Character / Location / Lore and their icons
4. `04-turkish-and-spanish-i18n.png`: Türkçe Library beside Español Book Compiler

(`_failure.png` in that folder is stale from the first run, before the dir06a route fix.)

## 6. Ready-for-Overhaul-03 Notes

- `packages/core` and `apps/reader` are untouched, and reader JS is still 19.5 KB gz, so the
  baseline for Gimmick System v2 is clean.
- New writer copy must add keys to all three locales. The typed records and the parity test fail
  fast on a missing key or a placeholder drift.
- Settings now has a home for future reader/gimmick dev toggles: `/settings-publishing`, under
  Publishing & Web. Keep the root to its 4 hubs.
