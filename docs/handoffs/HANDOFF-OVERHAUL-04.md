# HANDOFF — OVERHAUL-04: 7 Remaining Engines, v1 Retirement, FTS5 Catalog, Visual DNA Studio

Branch `feat/overhaul-04-engines-batch2-catalog-dna-studio` off `main` @ `b77b5e0` (OVERHAUL-03, PR #17).
Main Opus 5.5 (Medium): Phase A, bespoke-3d, reader cutover, exporters, Chrome Tide, QA. Worker 1 (`builder-sonnet`): engines 8-13 + batch C. Worker 2: Catalog, BlueprintForm, DNA Studio, i18n.
Both workers hit the usage limit once and resumed; their folders were disjoint.

## 1. Architecture & Public Contracts

```ts
// @kn/core/gimmicks — EngineAudio gains a host-tracked procedural output (audio-bed / audio-stinger / bespoke-3d)
interface EngineAudioGraph { readonly context: BaseAudioContext; readonly out: GainNode; readonly closed: boolean }
interface EngineAudio { readonly enabled; stinger(patch, opts?); graph(kind: 'bed'|'oneshot'): EngineAudioGraph | null }
//  host: `out` → ambience bus (bed) / sfx bus; ramped to 0 in 50 ms + disconnected on reduced, Calm or unmount
// @kn/core/dna — 'chamfer-tech' joins ORNAMENT_GRAMMARS (Holographic System); resolveVisualDna(...).tokens adds
//   --dna-redact-bg  (light ≈ oklch(.20 ≤.01 neutral) | dark oklch(.11 .01 hue), always < --dna-surface)
//   --dna-redact-border (light transparent | dark --dna-border) · --dna-redact-hatch (dark: -45° 1/6 px hatch)
//   --dna-page-bg (light L .968 C ≤ .012 | dark L .095 C ≤ .015, warmth-shifted hue) · --dna-page-font (prose)
//   --dna-warn / --dna-ok hues lerp 10 % toward the book's warmth-shifted neutral (still contrast-clamped)
// apps/writer/src/db — schema v3 (`gimmick_blueprints_fts` fts5 unicode61 remove_diacritics 2, JSON1 triggers)
interface CatalogQuery { text?; genre?; engine?; tier?: 'free'|'pro'; ids?: readonly string[]; limit? /* 200 */ }
DatabasePort.putGimmicks(packs, blueprints) · searchGimmicks(q): GimmickBlueprintRow[] · gimmickGenreCounts(): {genre,count}[]
class CatalogRepository { install(packs); search(q): {row, blueprint}[]; get(id); getMany(ids); genreCounts();
  favorites(); toggleFavorite(id): boolean; recent(); pushRecent(id) }   // settings: catalog/favorites, catalog/recent
// packages/engines/src/shared/webgl-stage.ts (imported ONLY by bespoke-3d)
acquireStage(): StageLease { renderer; scene; camera; bounds(); render(); readonly lost; release() }
webglStageStats(): { contextsCreated, live, leases, lost, geometries, textures, programs }  // window.__knWebglStage
// apps/writer/src/gimmicks/form-model.ts (BlueprintForm)
initialValues(bp, raw?) · fieldErrors(bp, values) · toCueProps(bp, values) → { blueprintId, ...props }
// field → control: text/multiline → TextInput · list → rows +add/remove/↑↓ · records → column rows · select → chips
//   number → stepper (min/max/step/unit) · boolean → Switch · color → hex + swatches; Zod via resolveBlueprintProps
```

- **Cue convention:** `{ kind:'module', moduleId: blueprint.engine, moduleVersion, props: { blueprintId, ...fields } }`.
  `prepareChapter` (store/sanitize.ts) inlines exactly the blueprints a chapter uses into `chapter.blueprints`,
  so Preview, Publish and exports are self-contained. The reader resolves inline first and falls back to the
  lazy starter chunk (sandbox / dev only).
- **Deleted:** `ModuleHost`, `LEGACY_CUES`, the 3 v1 arms + `loadModuleEntry/loadRendererFactory`, reader
  `stage.ts`/`stage-gl.ts`, the v1 sandbox (`legacy.ts`, `form.ts`), `three` from the reader's deps,
  `MODULE_GENRE_OVERRIDE` + `GENRE_*`/`LAYER_TRIGGER`, every `if (moduleId === …)` export branch (System Box
  table, gaslight / ghost / lighter / outcome heuristics), the flat `InsertSheets` picker, and the v1-only
  smoke files (`smoke-v2`, `smoke-warm`, `smoke-dice-materials`). `packages/modules/*` stays archived: only the
  writer registry still imports v1 schema/card barrels (to edit/print pre-v2 blocks); no app imports a v1 renderer.
- **Max touched file:** 248 lines (`gimmicks/form-records.tsx`); every new or modified source file ≤ 250.

## 2. Design Decisions & Trade-Offs

- **Soft Page Harmony vs `Aa`:**
  - (a) Chosen: a new default `Aa` theme/font, "Book". It keeps a concrete base palette in `data-theme` (warm
    or dark, from `prefers-color-scheme`) and adds `data-theme-pref="book"`. Only then do CSS rules map
    `--bg`/`--font-prose` to `--dna-page-*` (set on `:root` by dna-apply, cleared on every route change).
  - (b) Rejected: writing DNA straight onto `--bg`. Any manual Paper/Night/Obsidian/Serif/Sans choice would then
    have to undo it.
  - (c) Reversibility: high. Delete two CSS rules and the reader is back to OVERHAUL-03.
- **WebGL singleton vs per-cue disposal (bespoke-3d):**
  - (a) Chosen: one lazily created renderer and canvas, shared by every cue. Each cue disposes its own
    geometry, materials, env map and textures. On the last release the canvas is hidden and cleared, and it is
    disposed after 8 s idle with `forceContextLoss()`. Frames come only from `ctx.raf` (×20: 1 context, geo 0).
  - (b) Rejected: a renderer per cue. 20 cues would mean 20 contexts and risk Chromium's 16-context cap.
  - (c) Reversibility: medium. The lease API hides the stage.
- **Procedural audio-bed:**
  - (a) Chosen: a cached 2 s noise buffer, a biquad filter, an LFO and an optional sub-drone, built on
    `ctx.audio.graph('bed')`. The host ramps it to 0 and disconnects it, as well as the engine's own teardown.
    One bed plays at a time; a module registry crossfades.
  - (b) Rejected: MP3/OGG beds, which add bytes, R2 hosting and decode stalls.
  - (c) Reversibility: high. Swapping in a sampled source is one function in `audio-bed/scenes.ts`.
- **screen-fx cleanup:**
  - (a) Chosen: a fixed overlay appended to `body` (`pointer-events:none`, z-index 40). It copies the
    `--dna-*` values from its marker card and is removed on pause, reduced or destroy.
  - (b) Rejected: rendering inside the card. That cannot tint the viewport.
- **Catalog miniatures on Hermes:**
  - (a) Chosen: pure React Native Views tinted from `resolveVisualDna(bookDna)`: surface, accent border,
    radius, display-font approximation and engine glyph. Rows are a fixed 84 dp, so `getItemLayout` works.
  - (b) Rejected: a WebView or reader render per row (too heavy at 1,000 rows; CLAUDE.md §3.3). (c) High.
- **`gimmick_blueprints_fts` v3:**
  - (a) Chosen: an FTS5 table fed by triggers that read `config_json` through JSON1 (`json_extract`,
    `json_each` for tags/mood). No column migration is needed: v2 upgrades in place (idempotent DDL plus a
    rebuild), and `WIPE_ALL`/`replaceAll` rebuild it too.
  - The memory `CatalogIndex` reuses the nodes FTS grammar; a parity test runs the real SQL on `node:sqlite`.
  - (b) Rejected: denormalised columns. They need an ALTER migration and still need FTS for prefix search.
- **Exporters:**
  - (a) Chosen: `renderCue(block, format, inline)`. EPUB template output goes through `xmlVoid` (`<br>` → `<br/>`).
    Summary mode prints `[Name: summary template]`.
  - (b) Rejected: keeping the special-cased System Box table. It does not scale to blueprint #500.
  - Royal Road now gets the blueprint's `royalRoadHtml` blockquote instead of the bespoke navy table, a
    visible change from Directive 07.

## 3. Honest Self-Critique

- **Untested on Android hardware:** low-end WebGL context restore (loss path exists, no restore drill),
  procedural rain/hum realism and first-tap unlock, particle-field frame time on Adreno, and `KnReaderWebView`
  (compiles; the transport is still `react-native-webview`).
- **Mocked-only:** happy-dom has no WebGL, so `batch-d.test.ts` proves lite, Calm and ×20 only; the real stage
  (show/hide, `leases 0`, `geo 0`, 1 context) is proven in Chromium/SwiftShader smoke.
- **Bug the shots caught (fixed):** dark redacted words were readable through the new obsidian bars, because the
  kit's `.kn-e button{color:inherit}` (0,1,1) beat `color:transparent`. OVERHAUL-03 hid it only because the old
  bar was ink-coloured. Now `.kn-e .kn-e-text-alchemy__bar`, with a unit assertion and a smoke check.
- **Weak spots (seen in the shots):** the 3D dice roll across the chat card above them (no safe-margin
  routing yet); a stray filled "Typewriter" chip in the DNA Studio prose row; the dice result wraps mid-bracket at 390 px; `particle-field` runs raf while mounted (no
  IntersectionObserver); audio pills use emoji glyphs; empty `spatial-layout` labels print " / "; Catalog genre
  chips scroll instead of wrapping; DNA palette uses steppers; `ctx.dna` is frozen at mount (CSS and tiles are
  live, JS reads are not). Only starter blueprints are inlined on save; a future pack blueprint needs
  `pickBlueprint` to copy it into `chapter.blueprints` (OVERHAUL-05).
- **Retired QA flows / tooling:** the v1 shake prompt (2E) and v1 picker shots (4A) were removed, not faked;
  D-07's guide now counts 28. `build:preview-assets` can't rebuild from the repo root (`workbox-window`), so I
  used `--no-build`; `--clean` prebuild deletes `local.properties`; scripts need `NODE_PATH=$(npm root -g)`.

## 4. Cohesion & UX Alignment

- **Classic vs Interactive:** Insert Cue (the `tool-addGimmick` zap) stays hidden in Classic Novel. Visual DNA
  Studio is reachable from Novel Settings for both modes and also restyles the published reader page through
  "Book".
- **DNA Studio → Live Preview:** saving writes `visualDna` on the book node's `meta_json`. `toManifest` carries
  it, so Preview and Publish pick it up on the next payload, with no extra plumbing.
- **The 4 OVERHAUL-03 flaws (shot 02, measured in smoke):**
  - Dark bars are obsidian (luminance 0.017) and now actually hide their text.
  - Holographic shows chamfer-tech corners and ticks, unmistakable next to Noir's open brackets.
  - The OPEN stamp takes 4 distinct colours across 4 DNAs.
  - The wax seal is embossed, with a stamped ring and drop shadow.
  - The light column sits on the tinted Soft Page Harmony ground with no cool-on-cream clash.
- **One craft family:**
  - All 14 engines share the kit frame, `--dna-*` tokens, ornament layer, live tier attribute and `rt()` strings.
  - Batch 2 cards (shot 01) read as siblings of batch 1.
  - The weakest visual citizens are the slim audio pills and the stinger hairline, which are deliberately quiet.

## 5. Concrete Metrics & 14-Engine Matrix

| Engine          | Chunk gz                            | Starters                               | smoke ×20 H/L/R | live Calm proof                                    |
| --------------- | ----------------------------------- | -------------------------------------- | --------------- | -------------------------------------------------- |
| frame-hud       | 1.7 KB                              | system-notification, royal-decree      | 0/0/0           | sheet ✅                                           |
| chat-thread     | 2.2 KB                              | cyberbrain-link, sms-intercept         | 0/0/0           | pending → 0, runtime 0 ✅                          |
| text-alchemy    | 2.3 KB                              | gaslight-rewrite, redacted-file        | 0/0/0           | sheet ✅                                           |
| artifact-doc    | 1.6 KB                              | police-dossier, torn-diary             | 0/0/0           | sheet ✅                                           |
| tactile-reveal  | 3.0 KB                              | wax-seal-letter, biometric-lock        | 0/0/0           | Enter reveals ✅                                   |
| telemetry-meter | 3.1 KB                              | ekg-vitals, sanity-gauge               | 0/0/0           | raf cancelled ✅                                   |
| kinetic-prose   | 2.2 KB                              | typewriter-echo, whisper-shiver        | 0/0/0           | sheet ✅                                           |
| margin-note     | 1.8 KB                              | lore-footnote, pov-whisper-note        | 0/0/0           | Enter/Escape focus ✅                              |
| spatial-layout  | 1.8 KB                              | dual-pov-split, falling-lines-poem     | 0/0/0           | 0 overflow at 360 ✅                               |
| screen-fx       | 2.0 KB                              | frost-creep-chill, crt-scanline-glitch | 0/0/0           | overlay removed ✅                                 |
| particle-field  | 2.2 KB                              | cherry-blossom-drift, ember-storm      | 0/0/0           | raf stopped ✅                                     |
| audio-bed       | 2.3 KB                              | rain-on-tin, barroom-hum               | 0/0/0           | graph → 0, disconnected ✅                         |
| audio-stinger   | 2.1 KB                              | blade-unsheathe, level-up-chord        | 0/0/0           | unit (pause/reduced silence) ✅                    |
| bespoke-3d      | 2.9 + 1.6/25.3 + 133.8 three+cannon | dice-throw-3d, brass-lighter-3d        | 0/0/0, 1 ctx    | dice halt, canvas hidden, `[1, 1]` badge, geo 0 ✅ |

- **Bundle:**
  - Reader initial JS is **11.3 KB gz** (main 8.4 + preload 1.7 + tier-bus 1.2), against the 16.0 target.
  - Zod appears in **no** reader chunk; three/cannon sit only in `dice-mesh-*` and `high-*`, imported solely by the bespoke-3d chunks (checked from
    sourcemaps in `bundle-report.mjs`).
- **Catalog:** 1,000-blueprint FTS search + genre filter **0.56 ms** (memory), **0.51 ms** (SQLite); facets 0.13 ms.
- **Android:**
  - `expo prebuild --platform android --clean --no-install` ✅; `gradlew :app:processReleaseMainManifest :app:compileReleaseKotlin` BUILD SUCCESSFUL, including KnReaderWebViewManager.
  - Merged manifest: targetSdkVersion="36", allowBackup="false" plus backup and data-extraction rules,
    autoVerify="true", KnWriterWidgetProvider, `enableOnBackInvokedCallback` ×0.
  - Permissions: INTERNET, ACCESS_NETWORK_STATE, USE_BIOMETRIC, USE_FINGERPRINT, VIBRATE (0 restricted);
    0 new native deps, so 0 new `.so`.
- **Gates (final `@qa-runner` sweep + re-check):** `pnpm check` ✅ (tsc ×3, ESLint 0, **127 files / 1,277
  tests**) · `pnpm build` ✅ · `smoke.mjs` **31 ✅ / 0 ❌** (42/42 ×20 runs, 6 live-Calm proofs, 0 console errors) ·
  `writer:export` ✅ · `writer-shots.mjs` **178 ✅ / 0 ❌** incl. `smoke-publish.mjs` + tablet pack, 0 console errors.

## 6. Visual Evidence (`qa-shots-overhaul04/`)

1. `01-engines-batch2-dark-and-light.png`: 14 batch-2 cards, Noir Rain, dark | light. Check the dual-POV
   collapse at 360 and the particle density; the audio pills read "sound off" by design (no unlock in sheets).
2. `02-overhaul03-visual-fixes-verified.png`: 4 DNAs × (dossier, redacted, wax seal, system), dark | light.
   Check that the dark bars hide their words, the Holographic chamfer corners and the 4 stamp colours.
3. `03-chrome-tide-v2-calm-mode.png`: Live Preview High (3D dice mid-roll) | after live → Reduced (no canvas,
   static `[1, 1]` line).
4. `04-writer-fts5-gimmick-catalog.png`: Catalog (LitRPG chip, DNA-tinted miniatures) | BlueprintForm. Check the
   84 dp row density and chip contrast.
5. `05-book-visual-dna-studio.png`: archetypes + OKLCH/APCA card | 7-axis controls. Check the badge and chip wrap.

## 7. Open Calls (Android 16 Emulator Gate / OVERHAUL-05)

1. **Android transport:** flip Preview to `KnReaderWebView` (`WebViewAssetLoader`, 32 lazy chunks bundled), and
   gate that on emulator proof of the touch-scratch vs pager scroll conflict and the WebAudio first-tap unlock?
2. **R2 genre packs:** one signed JSON per genre pack (Ed25519 over a canonical `{packId, version, blueprints[]}`)
   installed through `CatalogRepository.install`, or per-blueprint files plus a manifest?
3. **Starter count for the Gimmick Factory:** 100 (about 7 per engine, tight QA) or 200? Every blueprint costs one
   Zod + export-template + sheet-overflow check in CI.
4. **Engine polish before mass generation:** a dice-result nowrap, a particle-field IntersectionObserver,
   template `{{#if}}` conditionals, and `ctx.onDnaChange` for JS-side DNA reads. Do all four first?
