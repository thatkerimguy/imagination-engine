# Phase 4A — Genre Gimmick Pack 1 + Phase 3 Polish (Directive 04A, Milestone 4)

Branch `claude/relaxed-mayer-wjqrw9`. Commits: `b273153` (Phase A1 polish), `0d64063`
(3 modules + writer/reader wiring + E2E scripts — the tree the QA sweep verified); this report follows on top.

## What shipped

| Area                                             | Files                                                                                                              | Notes                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pt-gaslight-edit` (inline, `psych-thriller`)    | `packages/modules/pt-gaslight-edit/{schema,card,state,styles,renderer}.ts` + 12 tests                              | Pure `step()` state machine `initial → armed → mutated`; swap happens on the first upward scroll while the passage is still off-screen (fallback: on re-entry). Both texts share one grid cell → zero layout shift on swap. `data-kn-state` for E2E. `once:false` flips text on every pass-then-return.                     |
| `gits-ghost-whisper` (inline, `gits`)            | `packages/modules/gits-ghost-whisper/{schema,card,whisper-state,styles,chime,renderer}.ts` + 15 tests              | `role=button`, `aria-pressed`, `data-kn-revealed`; hold (pointer), Enter/Space toggle, tilt with hysteresis (enter ≥ t, exit ≤ 0.65 t, angle wrap). Tilt only where no `requestPermission` prompt is needed. High: drift + chromatic shadow + procedural whisper; Lite: focus transition; Reduced: tap toggle, zero motion. |
| `bl-lighter-flick` (overlay-vfx, `black-lagoon`) | `packages/modules/bl-lighter-flick/{schema,card,controller,flame,lighter,sfx,styles,renderer}.ts` + 13 tests       | Canvas 2D flame (no three/cannon), DPR ≤ 1.5, dt ≤ 0.05 s, tilt ±22° or breeze; procedural clink/shhhk/whoomph/clack. Module-scoped active-flame controller: `extinguish` blocks snap it shut (220 ms fade). Ignites in `trigger()`, never at mount. `data-kn-lighter="lit                                                  | out"`. |
| Writer wiring                                    | `apps/writer/{package.json, src/modules/registry.ts, src/editor/gimmick-look.ts, src/export/gimmick-text.ts}`      | Barrels only. Feather: gaslight `eye-off`, ghost `radio`, lighter `sun`. Compiler transcript: gaslight/ghost print the visible line as prose + the hidden one as an italic cue; lighter prints "Lighter Flick flicks alight." / "snaps shut."                                                                               |
| Tests                                            | `registry.test.ts`, `boundary.test.ts`, `export/gimmick-text.test.ts`                                              | Boundary test now asserts the writer imports **every** module folder (6) and that no barrel-reachable file touches DOM / audio / sensor globals.                                                                                                                                                                            |
| Phase 3 polish                                   | `publish/PublishSettingsCard.tsx`, `publish/{cover-data,read-cover,read-cover.web}.ts`, `publish-client.ts`        | "Connected" status inset (`paddingHorizontal 12`, measured 12 px from the row edge). Native `file://` covers via `File.base64()`; MIME from magic bytes (extension fallback); > 1.5 MB → non-fatal warning, cover left out; web reads `data:` only. Platform reader is the default; DI kept.                                |
| E2E                                              | `scripts/smoke-pack-1.mjs` (chained in `smoke.mjs`), `scripts/writer-shots-4a.mjs` (chained in `writer-shots.mjs`) | Phase 3 publish pack now lands in `<dir>/regression`.                                                                                                                                                                                                                                                                       |

Reader discovery needed **zero** edits (`import.meta.glob` picks up new folders). `packages/core` unchanged.

## Deviations / choices to flag

- **Genres:** the directive's `psychological-thriller` / `cyberpunk` / `noir-action` aren't in the frozen core enum, so the
  modules use `psych-thriller` / `gits` / `black-lagoon`.
- **Package names:** `@kn/module-*` (matching the starter modules), not `@kn/mod-*`.
- **Ghost whisper audio:** High tier only (Lite stays silent).
- **Lighter flame:** a flame + warm corner glow (no drawn Zippo body). A new ignite replaces a lit flame silently.
- **Shot 03** is a two-panel composite (cue cards inline | sheet open), since the open sheet covers the cards.

## Subagent breakdown

- **Main (Opus):** Phase A (both polish fixes + tests, package scaffolds + single `pnpm install`), Phase C wiring, transcripts,
  boundary test, E2E scripts, visual review fixes (ghost line now inherits prose size; sandbox dock hidden for the flame panel),
  trimmed `whisper.test.ts` to 250 lines.
- **Workers 1–3 (Sonnet, parallel, disjoint folders):** one module each with its own Vitest file.
- **QA (Haiku):** the single sweep below.

## Verification (single sweep on `0d64063`)

| Check                                                  | Result                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                                           | ✅ typecheck (root + writer + publish-api), ESLint 0 warnings, **58 files / 695 tests** (was 643)                                                                                                                                        |
| `git diff 0246947..HEAD -- packages/core`              | ✅ empty                                                                                                                                                                                                                                 |
| Files > 250 lines / `any` / `innerHTML` in new modules | ✅ none                                                                                                                                                                                                                                  |
| `pnpm build` + `bundle-report.mjs`                     | ✅ initial reader JS **18.7 KB gz** (main 6.1 + module-host 12.6; +0.2 KB vs Phase 3 = three more glob-map entries)                                                                                                                      |
| New lazy chunks (gz)                                   | gaslight entry 1.0 + renderer 1.2 KB · ghost whisper 0.9 + 2.4 KB · lighter 0.8 + 3.8 KB (budget 12 KB) — none in `main-*.js`                                                                                                            |
| `pnpm build:preview-bundle`                            | ✅ 733.1 KB raw / 197.0 KB gz, all 6 modules inlined                                                                                                                                                                                     |
| `expo export` web + android                            | ✅ Hermes `.hbc` 4,555,116 B; 0 hits for `WebGLRenderer`, `MeshPhysicalMaterial`, `cannon-es`, `from 'three'`, `createRenderer`, `AudioContext`, renderer CSS markers in `.hbc` and web JS; schema names present                         |
| `smoke.mjs` (+ `smoke-pack-1.mjs`)                     | ✅ gaslight `initial → armed → mutated`; ghost hold reveal/release + reduced tap toggle; lighter ignite (canvas) → auto-extinguish at 1.8 s; **×20 No leaks on high/lite/reduced for all 3** (style tags also gone); zero console errors |
| `smoke-publish.mjs`                                    | ✅ regression green, zero console/page errors                                                                                                                                                                                            |
| `writer-shots.mjs --shots qa-shots-phase4a`            | ✅ all prior passes + 4A pass (6 modules in picker, 3 cue cards, schema sheet, Connected inset 12 px), zero console errors                                                                                                               |

## Screenshot pack (`qa-shots-phase4a/`, attached to the handoff)

1. `01-sandbox-pack1-trio.png` — gaslight before/after, ghost resting/held, lighter on High.
2. `02-writer-gimmick-picker-6-modules.png`
3. `03-writer-editor-new-gimmick-cues.png`
4. `04-settings-publishing-connected-fixed.png`
