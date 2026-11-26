# HANDOFF — OVERHAUL-02: Unified Rich Editor, Workspace Modes, 120 Hz Dock & Story Bible Backlinks

Branch `feat/overhaul-02-unified-editor-dual-audience` off `main` @ `b0fa40b` (OVERHAUL-01 merged).
Main: Opus 5.5 (Phases A, B, E). Workers: 2 × `@builder-sonnet` (modes · Story Bible), disjoint
files. Sweep: `@qa-runner`.

## 1. Unified Rich Editor & `react-native-enriched-markdown`

- **Installed `react-native-enriched-markdown@1.2.0`** (compat table lists RN 0.88). The opt-out block
  `{ enableCodeHighlight: false, enableMath: false, enableVideo: false }` is in **both** the root and
  `apps/writer` `package.json`, and `pnpm-workspace.yaml` `allowBuilds` blocks its postinstall.
  **No grammar or RaTeX assets were downloaded**: the package is 5.3 MB on disk and has no vendored
  grammar or ratex folders. The Android build reads the app `package.json`, so Media3 and math are
  excluded from the build.
- **Fallback guard not triggered:** prebuild, `:app:compileReleaseKotlin` (including
  `:react-native-enriched-markdown:compileReleaseKotlin`) and 16 KB ELF all pass (§4).
- **Per-run guard (fidelity):** the native editor rewrites what it cannot represent. Android
  serializes underline as `_x_`, and it has no highlight, colour, comment or escape support. So
  `RichSurface.tsx` mounts `EnrichedMarkdownTextInput` only for runs that round-trip byte for byte
  (`isEnrichedSafe`: `**`/`*`/`~~` only). Every other run uses the plain single-tap surface. A
  toolbar highlight, colour or comment hands an enriched run to the plain surface, focused.
  Landscape always uses the plain surface, because the enriched EditText does not expose
  `disableFullscreenUI` (Gate 3 C4). Kill switch: `ENRICHED_SURFACE_ENABLED`.
  `markdown-bridge.ts` handles source↔native conversion (`++`↔`_`/`__`, blank-line paragraphs ↔
  single lines) and plain↔source caret offsets.
- **Continuous prose runs (`prose-runs.ts`):** `blocksToSegments` merges adjacent plain prose into one
  `prose-run`, joined by `\n\n`. Dialogue, scene breaks and cues stay atomic. Styled blocks (heading,
  align, colour, whisper/emphasis voice) and beat stops stay standalone. `runToBlocks` keeps ids for
  unchanged leading and trailing paragraphs and reuses the rest positionally. In Classic Novel,
  hidden cues never stop a run and are re-anchored after their paragraph (`applyRunEdit` /
  `segmentsToBlocks`), so **no cue is ever dropped or moved**. Tests: 15 in `prose-runs.test.ts` + 7
  in `markdown-bridge.test.ts`.
- **Single tap:** a prose run is always a live input. At rest it shows WYSIWYG through a click-through
  rendered overlay, so one tap focuses and places the caret. Dialogue focuses on the selecting tap.
  `UnifiedBlocks` + `useEditorCore` are shared by `ChapterEditor` and `NoteEditor`, along with the
  same toolbar, `@` / `[[` popover and run↔block selection mapping. Format actions, find & replace
  and the Story Bible keep working per block.
- **Benchmark (10k words / 250 blocks):** run keystroke (edit + regroup the whole chapter)
  **0.18 ms**; legacy block keystroke + live metrics **1.21 ms** (budget 16 ms).

## 2. 120 Hz Keyboard Dock & `KeyboardAwareScrollView`

- `use-keyboard-dock.ts` (native) drives a Reanimated spacer under the FormattingToolbar from
  `useReanimatedKeyboardAnimation` on the UI thread, every IME frame, with no JS `Keyboard` events.
  The OS-resize compensation from `computeKeyboardOffset` runs inside the worklet. A spacer (height
  = `-height.value` minus resize) was chosen over `translateY` so the scroll area also shrinks and
  the last lines stay above the dock. `.web.ts` is a no-op.
- `keyboardOpen` (progress > 0.5, via `scheduleOnRN`) still feeds `shouldAutoCollapseMetrics`. The
  OVERHAUL-01 landscape auto-collapse gate stays green.
- `Page.tsx` now renders `PageScroll`: `KeyboardAwareScrollView` with `bottomOffset={24}` on native
  and a plain `ScrollView` on web. **`use-ime-reveal.ts` and its `setTimeout(60)` hack were deleted.**
  `Sheet.tsx` keeps the JS lift, renamed `ui/use-keyboard-lift.ts`.

## 3. Workspace Modes & Story Bible Backlinks

- `workspace/mode-policy.ts` `workspaceCapabilities('note' | 'prose' | 'interactive')` is the single
  source. **prose** hides ⚡ Insert Cue, Live Preview ▷ (button and shortcut), cue pills (cues hidden,
  never dropped), Record Mode, the gimmick export selector, Publish entry points and the Modules
  checklist. It keeps Compile (all formats), Outline, Version History, Read-Aloud, Story Bible and
  the static teaser. **interactive** is a strict superset. **note** keeps formatting, dialogue,
  scene breaks, links, Backlinks and Read-Aloud. The picker is in New Novel (Classic default) and
  Book Settings (reversible, zero data loss).
- **Links:** core `links.ts` (additive) adds `findWikilinks`, `renderWikilinks`,
  `extractWikilinkTargets` and `extractAllNodeLinks`. Wikilinks store as `reference` and `@` as
  `mention` in `node_links`. They resolve against non-trashed note, character, location, lore and
  chapter nodes. `sanitizeForReader` renders `[[Title|Alias]]` to its display text (raw sidecar keeps
  the source), and chapter links are read from the draft source.
- **Kinds:** Character, Location and Lore are documents like notes (same `NoteEditor`, FTS, links).
  Notes has a filter strip, row kind pills and a create menu (Note / Character / Location / Lore /
  Folder). `listBacklinks` excludes trashed and hidden sources. The collapsible "Referenced in N
  places" section appears in `NoteEditor` and the Story Bible peek card, and opens the chapter or
  note. Tests: `backlinks.test.ts` 4, `story-bible.test.ts` +3, `mode-policy.test.ts` 5, `nodes.test.ts` +5.

## 4. Prebuild, 16 KB ELF & Verification Sweep

- `expo prebuild --platform android --clean --no-install`: OK. `gradlew :app:processReleaseMainManifest
:app:compileReleaseKotlin`: **BUILD SUCCESSFUL** (1 m 47 s), incl. `:react-native-enriched-markdown:compileReleaseKotlin`.
  Full release APK via `scripts/build-android-apk.ps1 -SkipPrebuild`: **BUILD SUCCESSFUL** (15 m 46 s, 118.4 MB universal).
- Merged release manifest: `targetSdkVersion="36"`, `allowBackup="false"`, `fullBackupContent` +
  `dataExtractionRules`, `autoVerify="true"`, `KnWriterWidgetProvider` all present;
  **`enableOnBackInvokedCallback`: 0**; **restricted permissions: 0** (none of the five).
- **16 KB ELF:** new native lib `libreact_codegen_EnrichedMarkdownTextSpec.so` (built by the app CMake pass) is
  **0x4000 PASS on arm64-v8a and x86_64** (32-bit skipped). `verify-android-artifact.mjs` on the APK:
  **62 pass · 0 fail** · zipalign PASS · RESULT: PASS.
- `pnpm check` (`@qa-runner`): typecheck ×3 ✓, ESLint 0 warnings, **Vitest 104 files / 1035 tests** passed
  (8.9 s; 66 s wall). All nine named suites ran (77 tests).
- `pnpm build` + `bundle-report.mjs`: reader initial JS **19.5 KB gz ≤ 20.0 KB**, "Bundle budget OK".
- `writer:export` + `writer-shots.mjs --shots qa-shots-overhaul02`: **161 ✅ / 0 ❌**, zero console/page errors in
  every pack (incl. OVERHAUL-01 + OVERHAUL-02 packs, tablet). `smoke-publish.mjs`: **32 ✅ / 0 ❌**, zero errors.
- `git diff main -- apps/reader`: **empty**.

## 5. QA Screenshots (`qa-shots-overhaul02/`, git-ignored)

1. `01-prose-mode-clean-editor.png`: Chrome Tide switched to Classic Novel. No ▷, ⚡ or cue cards;
   one tap focuses a run.
2. `02-interactive-mode-editor.png`: Chrome Tide (Interactive Studio). Runs between cue cards, ⚡ + ▷.
3. `03-notes-kinds-and-backlinks.png`: Locations filter with pill, and the Harbour District note with
   "Referenced in 1 place → Snake Eyes" (the excerpt shows the rendered wikilink).
4. `04-new-novel-mode-picker.png`: Classic Novel (selected) vs Interactive Studio.

Legacy gates updated for the new model: the WYSIWYG check reads the run's `-view` overlay; the
new-novel flow asserts that Classic hides ⚡; 4a and ov01 tap the prose run, not `block-*`.

## 6. Ready-for-Overhaul-03 Notes & Open Decisions

- **On-device check needed:** the enriched surface was build-verified, not run on a phone. Confirm
  caret mapping, the `_x_`→`++` underline round trip and IME behaviour on a Pixel and a Samsung. If
  anything misbehaves, set `ENRICHED_SURFACE_ENABLED = false` (one line).
- Cues are hidden, not removed, in Classic Novel. Gimmick System v2 engines should keep
  `module` blocks as the only cue carrier so `prose-runs` re-anchoring keeps working.
- `EngineRuntimeContext` can read `workspaceCapabilities(mode).livePreview` to gate preview payloads.
  Today Preview is only reachable in Interactive Studio.
- Cosmetic follow-up: the Recent strip and Trash still label Character, Location and Lore items as
  "Note".
