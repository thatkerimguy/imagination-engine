# Phase 2C Report — "Folio" Editorial UI/UX Overhaul (`apps/writer`)

**Branch:** `ccr-472ca507-a57p0f`, on top of 02B-1. `claude/cool-wozniak-070yo4` (`cef4b82`, which
includes `a8f6bf3`) was fast-forwarded onto `main` before this work started.
**Scope:** DIRECTIVE 02C only, meaning the Folio design system, the screen overhaul and the 02B-1
visual fixes. 02B-2 is not built: folders, cross-workspace search, version history, book compiler,
master lock and Document Doctor.

## Verification

| Check                                                             | Result                                                                                                |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm check` (typecheck root + writer, ESLint 0 warnings, Vitest) | ✅ 31 files · **471 tests** (`tokens.test.ts`: 12 themes × 22 AA pairs + hairline + token checks)     |
| `git diff 0246947..HEAD -- packages/core`                         | ✅ empty                                                                                              |
| `git diff cef4b82..HEAD -- apps/reader`                           | ✅ empty                                                                                              |
| `any` / M3 remnants in `apps/writer/src`                          | ✅ 0 (no `m3`, MaterialIcons, chips, FAB, SegmentedButtons, `m3-tokens`)                              |
| Files > 250 lines in `apps/writer/src`                            | ✅ 0 (largest: `ChapterEditor.tsx` 250)                                                               |
| `pnpm build` + `bundle-report.mjs`                                | ✅ reader initial JS **18.5 KB** gzipped (`main` 6.1 + `module-host` 12.4) / 40 KB; `three` lazy only |
| `expo export --platform web`                                      | ✅                                                                                                    |
| `expo export --platform android`                                  | ✅ Hermes `.hbc` 3,923,878 bytes (−29 KB vs 02B-1); `cannon-es`/`THREE.WebGLRenderer`/paper grep = 0  |
| `node scripts/smoke.mjs` (reader + preview)                       | ⏳ re-run in progress (all checks ✅ in the QA pass; process hung on teardown — pre-existing)         |
| `node scripts/writer-shots.mjs --shots qa-shots-2c`               | ✅ 15/15 checks, **zero console errors**, 7 Folio PNGs (+ live-preview PNG), attached to handoff      |

## Agents

| Agent                        | Scope                                                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main (Opus)                  | Phase A: `palette.ts`, `themes.ts`, `tokens.ts`, `type.ts`, all `ui/*` primitives, header-scroll, `_layout`. Phase C: M3 removal, novel summary, post-QA fixes, shots |
| Worker 1 (`@builder-sonnet`) | Library, New novel, Book Outline, Novel/App Settings, `BookCoverThumb`, `library/*`                                                                                   |
| Worker 2 (`@builder-sonnet`) | Chapter editor, metrics strip, block rail + active strip, cue strips, formatting rail, focus mode, all editor sheets, `GimmickSheet` + `forms/controls/*`             |
| Worker 3 (`@builder-sonnet`) | Text Analysis sheet, frequency bars, Growth, Appearance & fonts (paper preview, mini-page swatches, family picker), Live Preview chrome                               |
| `@qa-runner` (Haiku)         | Single full verification pass                                                                                                                                         |

## Folio system

- **Colour roles** (`ui/palette.ts`): `canvas`, `surface`, `surfaceElevated`, `surfaceTint`, `ink`,
  `inkSecondary`, `inkMuted`, `onAccent`, `hairline`, `borderStrong`, `accent`, `accentSoft`, `warm`,
  `danger`, `dangerSoft`, `success`. Each of the 12 themes is 11 hand-tuned base hexes. Washes and
  hairlines are mixed from those bases, so all themes share the same quiet relationships.
- **Tokens:** radii are 6 / 10 / 14 / 16 / 20 / pill. Spacing is 4–32 with a 20dp gutter. Touch
  targets are 44dp. Type uses an editorial serif for titles and prose, and the system sans with
  tabular figures for chrome.
- **Icons:** Feather is the only icon family.
- **Primitives:** `TopBar` (52dp, hairline only when scrolled), `UnderlineTabs`, `SegmentControl`,
  `ActionButton`, `IconBtn`, `Toggle`, `Field`, `Stepper`, `Sheet`, `ConfirmDialog`, `PopoverMenu`,
  and `Page` / `ListRow` / `SectionLabel` / `Dot` / `EmptyState`.

## 02B-1 visual bugs fixed

- **Duplicate Beat badge:** the block and the gimmick pill each drew one. It now appears once, inside
  the cue strip, and `writer-shots` asserts this.
- **`Comfor…` / `30 Da…` / `Lif…` truncation:** fixed with `UnderlineTabs` (1D 7D 30D 1Y All) and
  `Tight | Medium | Wide` segments. The Frequency filter is sized so "Grammar" fits at 390dp.
- **Italic font rows:** the font picker showed a separate row for each italic face. It now shows
  one row per family. Italic faces stay registered, so `*italic*` still renders true italics.
- **Web focus box:** the browser drew a focus outline around the active paragraph. It is suppressed
  for text inputs only (`ui/web-focus.ts`); Folio's own accent ring and rail replace it. Buttons
  keep the browser's keyboard focus ring.

## Choices to flag for the Author

1. **System theme:** this is now a "Match system" toggle above the swatches (`theme-system`).
2. **Load demo:** it is no longer on the Library screen once novels exist. On an empty shelf it
   is a main button; otherwise it lives in App Settings as "Reset demo novel".
3. **Insert below:** removed from the active-block strip, per the directive's icon list. The rail's
   add buttons insert after the selected block, so the capability remains.
4. **Margins segment in the editor's layout sheet:** Worker 2 added it, wired to the existing
   margin pref. Easy to drop.
5. **Library metadata line:** it can wrap to two lines rather than truncate. `NovelSummary` now
   carries `words` and the novel's `--accent` colour (`store/novel-summary.ts`) for the spine.
6. **Shot pack:** it now emulates a dark system scheme, so the "dark" screenshots show the
   Editorial Teal night theme.
