# Phase 2B-1 Report — Rich Editor, 27 Analyzers, Growth Charts, 12 M3 Themes & Fonts

**Verified commit:** `a8f6bf3` on `claude/cool-wozniak-070yo4` (not yet merged to `main`; the session's
push rules restrict it to this branch). Baseline: Phase 2 Pass 2 (`a8ce46e` / `34a31ff`).
Scope: DIRECTIVE 02B-1 only. Not built: folders, cross-workspace search, version history, book
compiler, master lock, Document Doctor (DIRECTIVE 02B-2).

## Verification

| Check                                                             | Result                                                                                                                                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` (typecheck root + writer, ESLint 0 warnings, Vitest) | ✅ 31 files · **410 tests**                                                                                                                              |
| `git diff 0246947..HEAD -- packages/core`                         | ✅ empty                                                                                                                                                 |
| `any` in `apps/writer/src` + `apps/reader/src`                    | ✅ 0                                                                                                                                                     |
| `pnpm build` + `bundle-report.mjs`                                | ✅ reader initial JS **18.5 KB** gzipped (`main` 6.1 KB + `module-host` 12.4 KB) / 40 KB budget; `three` only in a lazy chunk (128.5 KB); no `cannon-es` |
| `expo export --platform web`                                      | ✅ `dist/_expo/static/js` 2.0 MB                                                                                                                         |
| `expo export --platform android`                                  | ✅ Hermes `.hbc` **3,953,304 bytes** (3.77 MB); heavy-import grep (`cannon-es`, `THREE.WebGLRenderer`, `three/build`) clean                              |
| `node scripts/smoke.mjs`                                          | ✅ 12/12, incl. new "preview renders inline bold / italic / highlight; raw `<script>` stays inert text"                                                  |
| `node scripts/writer-shots.mjs`                                   | ✅ 12/12 checks, **zero console errors**, 6 PNGs in `qa-shots-phase2b-1/` (git-ignored, attached to handoff)                                             |
| 10,000-word `analyzeDocument` latency (Node, TS)                  | **~27 ms** (test asserts < 500 ms)                                                                                                                       |

Reader initial JS grew 18.1 → 18.5 KB for the inline renderer (target < 20 KB met).

## Subagent breakdown

| Agent                        | Scope                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main (Opus)                  | Phase A: deps + `app.json`, reader `renderInline`, 12 themes + ThemeProvider + Pass 2 polish, `inline-markup`/`inline-edit`, `writer-prefs`, `chapter-styles`, `growth-store`, `analysis/metrics.ts` contract. Phase C: `use-chapter-draft` (history + sidecar + growth), `use-format-actions`, `EditorChrome`, `ChapterEditor`, route, QA scripts, post-QA fixes |
| Worker 1 (`@builder-sonnet`) | `analysis/*` (27 metrics, static frequency/extractor), `charts/*`, `views/TextAnalysisSheet` (+ 3 tab files), `app/growth.tsx`                                                                                                                                                                                                                                    |
| Worker 2 (`@builder-sonnet`) | `history`, `InlineRichText`, `RichProseInput`, `FormattingToolbar`, `MetricsRibbon`, `OutlineSheet`, `find-replace` + `FindReplaceBar`, `LayoutPrefsSheet`, block editor + scene-break rewiring                                                                                                                                                                   |
| Worker 3 (`@builder-sonnet`) | `fonts/*` (catalog, native/web loaders, validate, registry), `app/appearance.tsx`                                                                                                                                                                                                                                                                                 |
| `@qa-runner`                 | Full sweep (check, build, bundle report, web + Android exports, smoke, shots)                                                                                                                                                                                                                                                                                     |

## Subsystems (function level)

- **Reader inline renderer** — `reading/inline.ts` `renderInline(el, text)`: `**` `*` `++` `~~` `==` + `\` escapes, DOM via `createElement`/`createTextNode` only; used for prose and dialogue in `blocks.ts`; `<mark>` tinted with `color-mix(var(--accent) 26%)`.
- **Inline markup core** — `parseInline` → AST, `inlineRuns` → flat styled runs, `stripInlineMarkup` (analyzers), `sanitizeForReader` (keeps core spans byte-for-byte, drops `{fg}`/`{bg}`/`{{comment}}`; identity on text without them). `inline-edit.ts`: `toggleMark`, `wrapColor`, `insertComment`, `insertText`.
- **Canonical vs writer-only data** — `prepareChapter` stores `sanitizeForReader(text)` and treats markup-only blocks as unfinished. The Author's full source text is kept in `meta/chapter-styles/<chapterId>` as a per-block `raw` field (alongside align/indent/heading/quote/list/fg/bg) and restored on load only if it still sanitizes to the stored text — so an imported or externally edited chapter always wins.
- **Themes** — `ui/themes.ts`: 12 schemes from the directive table (6 night, 6 day); `m3-tokens.test.ts` asserts 18 pairs × 12 = **216 AA pairs**. `ThemeProvider` reads `prefs/writer-ui`; first load migrates Phase 2 `appearance` (`dark`/`light`/`system`).
- **Prefs** — `writer-prefs.ts` normalizes theme/font/size/line height/margins/indent/align/Samsung IME/ribbon/metrics/toolbar order; new tools are appended for older saved orders. `prefs/custom-fonts` registry.
- **Editor** — unfocused blocks render WYSIWYG `<Text>` runs (no raw syntax); the focused block is an auto-growing `TextInput` with ref-guarded controlled selection. Toolbar actions: spans on the selection, block styles via the sidecar, `Tab` inserts `\t`, Separator inserts an unlabeled scene break, colours apply to the selection (span) or the whole block when nothing is selected. Undo/redo: `History<{chapter, styles}>`, 800 ms same-block typing coalescing, 100 entries, feeding the 600 ms autosaver.
- **Metrics** — `analyzeDocument` (abbreviation-aware sentences, contraction/hyphen-aware words, O(N) incremental MATTR-50, syllable heuristic, Flesch, FK, Fog, SMOG with estimate flag, Coleman–Liau, ARI, dialogue share). `useLiveMetrics` throttles to 250 ms; typing meter = rolling 60 s window pausing after 5 s idle.
- **Growth** — on each autosave flush `logChapterGrowth` records `chapter:<id>` and `novel:<id>` snapshots (one stored point per 5 min, forced on editor close); Growth screen charts daily rollups per timeframe.
- **Fonts** — 26 presets (6 system stacks + 20 faces: 10 families × Regular/Italic) imported per-face `.ttf` (no barrels); lazy `Font.loadAsync`. Custom import validates extension + magic bytes (`00010000`, `true`, `OTTO`); native copies to `Paths.document/fonts/<ulid>.<ext>`, web stores a ≤ 2 MB data URI; keys `custom-font-<ulid>`.

## Snake Eyes golden values (all matched)

653 chars · 531 no spaces · 118 words · 15 sentences · 6 paragraphs · 87 unique · 73.7 % unique ·
49.2 % lexical density · 85.8 % MATTR-50 · 86.3 Flesch · 10.2 % dialogue. Definitions: chat lines
excluded by default, blocks joined with a blank line for character counts. Worker 1 initially got
55.1 % density; adding closed-class indefinite pronouns (nobody, nothing, somewhere…) plus
`else`/`inside`/`outside` to the grammar list gave 49.15 % — standard function words, not tuning.

## Decisions & deviations to review

1. **Branch:** pushed to `claude/cool-wozniak-070yo4`, not `origin/main`; merge when approved.
2. **Toolbar on web:** Worker 2 used `onPressIn` to keep the keyboard up; it never fires on
   react-native-web (QA caught "+ Prose" doing nothing). Switched to `onPress`; on native,
   `keyboardShouldPersistTaps="always"` keeps the input focused. **Verify on device** that the
   caret/selection survives a toolbar tap on Android Gboard + Samsung Keyboard.
3. **Shot 04 uses synthetic history:** the QA script seeds 40 days of `growth/chapter:ch01` points
   (only if absent) so the Lifetime chart has a curve; the final point is real.
4. **Inline toggles helpers** live in `editor/inline-edit.ts` (directive named `inline-markup.ts`)
   to keep both files under 250 lines.
5. **`ChapterEditor.tsx` is 262 raw lines** (ESLint `max-lines` passes as it skips blanks/comments).
6. **`userInterfaceStyle`** set to `automatic` so the System theme and day themes get matching OS
   chrome; `expo-font` config plugin was added by `expo install`.
7. **Clipboard:** `expo-clipboard` is not installed, so Extract items copy on web only; on native
   they are selectable text.
8. **Fonts:** bold faces are not bundled (RN synthesizes bold); Android `rounded-ui` maps to
   `sans-serif-light` (no rounded system face). First-line indent is two em-spaces (RN has no
   `textIndent`).
9. **Growth range labels** ("30 Days", "Lifetime") truncate at 390 dp in the segmented control.
10. **Pre-existing:** a module block with `beatStop` shows both the pill's Beat chip and the
    block-level Beat badge (unchanged from Phase 2).

## Real-device notes (not yet tested on hardware)

Expo Web and the Android Hermes bundle build cleanly; nothing has been run on a physical phone.
Priority checks: Android IME cursor stability while typing in a focused block (with and without
Samsung IME Safe Mode), `softwareKeyboardLayoutMode: resize` keeping the toolbar above the
keyboard, custom font import from Files on Android/iOS, and SVG chart touch inspection.
