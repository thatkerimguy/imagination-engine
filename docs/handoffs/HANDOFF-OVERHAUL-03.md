# HANDOFF — OVERHAUL-03: Gimmick v2 Core, 7-Axis Visual DNA, EngineRuntimeContext, First 7 Engines

Branch `feat/overhaul-03-gimmick-v2-core-engines` off `main` @ `b961a0a` (OVERHAUL-02A, PR #16, merged).
Main Opus 5.5 (Medium) did Phase A (core + `engines/shared`), C (reader), D (Android) and E (QA).
Two `builder-sonnet` workers built engines 1-4 / 5-7 in disjoint folders. `qa-runner` ran the sweep;
its first pass found 2 blockers (fixed, §3), and the final gate re-run is in §5.

## 1. Architecture & Public Contracts (as implemented)

```ts
// @kn/core/gimmicks — zero-dep (types.ts, props.ts, templates.ts, security.ts, guard.ts, runtime.ts)
type EngineId = 'frame-hud'|'chat-thread'|'text-alchemy'|'artifact-doc'|'tactile-reveal'|'telemetry-meter'
  |'kinetic-prose'|'margin-note'|'spatial-layout'|'screen-fx'|'particle-field'|'audio-bed'|'audio-stinger'|'bespoke-3d';
interface GimmickBlueprint {
  id; version; engine: EngineId; genre; subgenre; mood: string[]; tags: string[]; name; tagline; tier: 'free'|'pro';
  fields: BlueprintFieldSpec[];   // text|multiline|list|records{columns}|select|number|boolean|color, `optional?`
  defaultProps: BlueprintProps; sampleProps: BlueprintProps;   // string|number|boolean|string[]|Record<string,string|number>[]
  visual: { layout; ornament: OrnamentGrammar|'inherit'; surface?: SurfaceMaterial|'inherit';
            accentRole: 'primary'|'secondary'|'warning'|'success'|'neutral'; borderStyle; motionPreset };
  sound?: { patch: StingerPatch; gain?; pitchShift? }; haptics?: 'none'|'tap'|'pulse'|'heavy'|'double';
  exports: { transcript; summary; epubXhtml; royalRoadHtml };
}
interface EngineRuntimeContext {
  readonly tier: 'high'|'lite'|'reduced'; readonly calm; readonly paused; readonly signal: AbortSignal; readonly dna: ResolvedVisualDna;
  onPause(cb): Unsubscribe; onResume(cb): Unsubscribe; onTierChange(cb: (t) => void): Unsubscribe;
  raf(cb: (tMs) => void): Unsubscribe;          // one-shot, deferred while paused
  timeout(cb, ms): Unsubscribe; interval(cb, ms): Unsubscribe;   // tracked; remaining time held on pause
  audio: { readonly enabled; stinger(patch, {gain?, pitchShift?}?) }; haptics(p): void;
  surfaceTile(material): string /* url(data:…) | 'none' */; ornamentSvg(grammar): SVGSVGElement /* inset:0 layer */;
}
interface GimmickEngine { id: EngineId; mount(host, blueprint, props, ctx): { trigger(): Promise<void>; destroy(): void } }
// @kn/core/dna
interface BookVisualDna { palette{hue,chroma,warmth,secondaryHue,contrastMode:'balanced'|'high'};
  typography{display,prose,diegetic: 'serif-editorial'|'serif-antique'|'sans-clean'|'sans-condensed'|'mono-terminal'|'mono-typewriter', tracking};
  surface{material,grainIntensity}; ornament{grammar,radius,strokeWidth}; motion{personality,tempo};
  atmosphere{style,intensity}; sonic{timbre,gain} }
```

**Files (max 249 lines; every new or modified source file ≤ 250)**

- `packages/core/src/gimmicks/`: types 152, props 126, templates 77, security 59, guard 46, runtime 75, validate (Zod) 148.
- `packages/core/src/dna/`: types 112, contrast 140, resolve 106, archetypes 98, guard 79.
- `packages/core/src/guard/content.ts` 166: zero-dep mirror of `schema.ts`.
- `packages/engines/src/shared/`: dom-safe 112, kit 137, ornaments 114, surface-tiles 148, synth-stingers 156, test-context 168.
- Engines (each `index` + `styles` + helpers): tactile-reveal/index 249 is the tightest; telemetry `gfx` 194, text-alchemy `modes` 184.
- `apps/reader/src/`: engine-loader 95, runtime-context 175, dna-apply 103; `runtime/` scheduler 113, block-host 81, blueprint-host 90, cue-resolve 54, tier-bus 29; `sandbox/` v2 197, sheet 109, blueprint-form 123.

**Zero Zod in the reader**

- `@kn/core` is `"sideEffects": false`.
- The reader imports only the zero-dep subpaths `@kn/core/guard`, `@kn/core/gimmicks` and `@kn/core/dna`.
- The Zod validator lives at `@kn/core/gimmicks/validate` and is used only by tests (writer and factory later).
- `data.ts` and `preview/protocol.ts` switched from `parse*` (Zod) to `check*` in `guard/content.ts`.
- `guard.test.ts` runs 25 accept/reject parity cases against the Zod schemas, and the outputs are equal too.
- `bundle-report.mjs` now fails if any reader sourcemap lists a `zod` source.

**How a `module` block resolves** (`runtime/block-host.ts`, the only piece in the initial chunk):

1. `moduleId ∈ {bl-dice-3d, bl-lighter-flick, core-ambient-bed}`: lazy `ModuleHost`, a temporary v1 arm via static `import()` in `engine-loader.ts`.
2. Otherwise: lazy `BlueprintHost`, which then picks one of:
   - **v2 cue:** `props.blueprintId`, resolved from inline `chapter.blueprints[id]` (re-checked by `guardBlueprint`) or a starter blueprint. These bypass `enabledModules`, since they are data.
   - **retired v1 cue:** `LEGACY_CUES[moduleId]` maps the v1 props onto a starter (cyberbrain → `cyberbrain-link`, gaslight / ghost-whisper → `gaslight-rewrite` with mode, system box → `system-notification`).
3. `loadEngine` is a static `switch` over 14 ids. The 7 OVERHAUL-04 engines render a calm placeholder notice.

The `module` block shape and `prose-runs` are untouched. The v1 module folders stay as writer schemas.

## 2. Design Decisions & Trade-Offs

- **Contrast clamping** (`ensureContrast`):
  - (a) Step L by 0.02 toward 0.98 (dark) or 0.12 (light), easing chroma off past L 0.88 / below 0.22. Each token is checked against ALL THREE grounds (bg, surface, surface-alt). Backgrounds are pinned very dark or very light, so a white/black fallback always passes.
  - (b) Rejected: hue rotation or picking from a fixed palette. Both lose the book's identity.
  - (c) Easy to change: `resolve.ts` is pure. Ink and muted text use the body bar (4.5 / Lc 60), raised to 7 / Lc 75 in `contrastMode: 'high'`.
  - Gamut: an 8-step chroma binary search (per the spec) with a ±0.002 tolerance before clipping. Without the tolerance, `#ff0000` came back as `#ff0402`.
- **Zero-dep guards beside Zod:**
  - (a) A hand-written mirror plus a parity test.
  - (b) Rejected: keeping Zod lazy in the reader. Chapter parsing sits on the critical path, so Zod would be in the first fetch anyway.
  - (c) Cost: two validators must stay in step; the parity test guards that. Content-schema edits must touch both files.
- **CSS scoping:**
  - (a) Engines read `var(--dna-*)` from the reading root (or a sheet cell), plus a per-card `--kn-e-accent`. Each engine injects `<style data-kn-engine>` once, and the base frame lives in `shared/kit.ts`.
  - (b) Rejected: Shadow DOM, which breaks reader typography inheritance and find-in-page.
  - (c) Low cost to change.
- **Ornaments:**
  - (a) One 24-unit top-left path, mirrored into 4 corners by nested `<svg x="100%">` anchors, so cards of any size get crisp corners with no stretching.
  - (b) Rejected: a 9-slice `border-image` (raster) and a `preserveAspectRatio="none"` stretch.
  - (c) Adding a grammar means adding one recipe.
- **Ornament `inherit`:** I changed 8 starters to `inherit` after the DNA shot. As the workers wrote them, all 14 starters pinned an ornament, so the ornament axis did nothing. Royal-decree, torn-diary, wax-seal and redacted-file keep their genre ornament on purpose.
- **Surface tiles:**
  - (a) 128 px Canvas 2D, Mulberry32 seeded by material name, cached per (material, theme, grain-step 1-4).
  - (b) Rejected: per-frame `feTurbulence`.
  - (c) The tile is baked with theme ink; a live theme switch re-applies the DNA tokens, but an already-mounted card keeps its old tile until remount.
- **Live tier:**
  - (a) `kn:tier-change` is dispatched by reader Settings, the writer `{type:'tier'}` message and the sandbox. Every context re-emits it to its engines, and timers/raf are held centrally.
  - (b) Rejected: a remount on tier change (the old behaviour).
  - (c) The v1 dice/lighter/ambient arms do NOT follow live tier; they switch on the next chapter mount.
- **tactile-reveal thresholds:** 650 ms hold, ≥ 35 % of a coarse grid swept, Enter always instant. `trigger()` never waits for the reader; it gives a ≤ 600 ms attention cue so pacing never blocks.
- **telemetry threshold** (worker call, kept): `bars` warns at ≤ threshold, a depleting gauge (sanity 28 / 30 warns). The other styles warn at ≥. It's one line to flip.
- **WebViewAssetLoader vs the Fabric interop:**
  - (a) Shipped `plugins/android-webview-assets.js`. It adds `androidx.webkit:webkit:1.12.1` and generates `KnReaderWebViewManager.kt` / `KnReaderWebViewPackage.kt`, registered in `MainApplication`. That is a legacy `SimpleViewManager` on the New-Arch interop: its own `WebView` with file and content access off, the asset loader on `https://appassets.androidplatform.net/reader/`, the `KnHostBridge.postMessage` → `onKnMessage` event, and a `postMessage` command → `window.__knReceive(JSONObject.quote(json))`. The reader side of both bridges is wired in `preview/view.ts`.
  - **Fallback guard TRIGGERED for the runtime transport.** It compiles cleanly, but this session had no device or emulator to validate interop event delivery, the `dispatchViewManagerCommand` path or gesture/scroll inside the RN pager. The writer JS therefore still mounts `react-native-webview` + `reader-preview.html` on Android.
  - (b) Rejected: patching `RNCWebViewClient`, and subclassing `RNCWebViewManager`, whose codegen'd Fabric spec is bound to its own name.
  - (c) Switching over is one `PreviewFrame.android.tsx` using `requireNativeComponent('KnReaderWebView')` plus a hardware check.
  - `pnpm build:preview-assets` copies 49 files (37 lazy chunks, 853 KB raw) into `android/app/src/main/assets/reader/`. It is chained after prebuild in `android:prebuild`, because `--clean` wipes `android/`.

## 3. Honest Self-Critique

- **Untested on real Android:** the KnReaderWebView runtime, tactile-reveal pointer capture inside the RN WebView (scroll-vs-scratch conflict), the haptics patterns, and WebAudio stingers before the first tap. The stingers no-op until the curtain unlocks the bus; that is by design but unverified on device.
- **Mocked, not end-to-end:**
  - Engine unit tests use `createTestContext` (fake clock and frames) under happy-dom, which has no Canvas, so surface tiles return `'none'` there.
  - The real runtime-context is exercised only by Playwright: smoke ×20, live tier, and the sheets.
- **Two blockers from the first QA sweep, both fixed:**
  - ESLint was linting the generated `android/…/assets/reader` copy; `apps/writer/android/**` is now ignored.
  - A real bug: on a mid-chapter resume, the lazily mounted v2 chat card grew above the resume point after the first scroll, pushing the dice below the fold so they never triggered. The Pacer now re-anchors once the replays have mounted.
- **Stale DNA in a mounted context:** `ctx.dna` is frozen at mount, so engines that read `ctx.dna.theme` stay stale after a live light/dark switch; CSS tokens update.
- **Kinetic-prose:** a very long unbroken word can overflow (no hyphenation).
- **A11y strings:** the tactile-reveal `?` glyph and the ARIA labels ("Look again", "Reveal redacted text") are English-only reader strings.
- **Tight for OVERHAUL-04:**
  - `tactile-reveal/index.ts` (249 lines) has to split before it grows.
  - `smoke.mjs` and `writer-shots.mjs` sit at 240 and 250 lines.
  - The blueprints chunk (6.3 KB gz for 14) will not scale to 1,000. It needs per-genre packs, or an FTS index plus fetch-on-demand.
  - `blueprint-host` (6.5 KB) bundles DNA math and the guards; it is fine now, but split `dna-apply` out if a page only needs tokens.

## 4. Cohesion & UX Alignment

- **Do the 4 DNA archetypes read as different books?** Yes for palette, type voice (Antique Parchment and Classified Dossier swap to serif or typewriter), radius, grain and atmosphere.
  - Before the `inherit` fix the ornaments were identical, which made it look like recolouring.
  - Still weak: the artifact-doc "OPEN" stamp is `--dna-warn`, so it is near-identical orange in every book.
  - Body layout and density don't vary per DNA; only tokens do.
- **Calm Mode:** it is serene. Lines land at once, loops stop (`runtime 0`), there is no sound, and the static cards stay fully legible.
- **Light theme:** cards are re-resolved, but Noir Rain's cool teal-white cards sit on the reader's warm paper. The DNA styles the cards, not the page; a product call for OVERHAUL-04.
- **Keyboard/ARIA:** every interactive control is a native `<button>`.
  - tactile-reveal has `aria-expanded`/`aria-controls`.
  - The whisper toggle has `aria-pressed`; redaction bars have `aria-label`.
  - Meters are `role="meter"`; kinetic-prose has a screen-reader copy plus an aria-hidden animation layer.
  - Consistent, but there is no visible focus style beyond the kit outline.

## 5. Concrete Metrics & Verification Matrix

| Engine          | Lazy chunk (gz) | Starters                          | Kind        | smoke ×20 high/lite/reduced | live tier-change            |
| --------------- | --------------- | --------------------------------- | ----------- | --------------------------- | --------------------------- |
| frame-hud       | 1.7 KB          | system-notification, royal-decree | passive     | 0/0/0 leaks                 | via sheet ✅                |
| chat-thread     | 2.2 KB          | cyberbrain-link, sms-intercept    | passive     | 0/0/0                       | 1 pending → 0, no reload ✅ |
| text-alchemy    | 2.2 KB          | gaslight-rewrite, redacted-file   | interactive | 0/0/0                       | via sheet ✅                |
| artifact-doc    | 1.6 KB          | police-dossier, torn-diary        | passive     | 0/0/0                       | via sheet ✅                |
| tactile-reveal  | 2.7 KB          | wax-seal-letter, biometric-lock   | interactive | 0/0/0                       | Enter reveals ✅            |
| telemetry-meter | 3.1 KB          | ekg-vitals, sanity-gauge          | passive     | 0/0/0                       | raf cancelled, runtime 0 ✅ |
| kinetic-prose   | 2.2 KB          | typewriter-echo, whisper-shiver   | passive     | 0/0/0                       | via sheet ✅                |

- **Reader initial JS: 19.5 KB → 12.7 KB gz** (main 8.4 + prefs 1.6 + tier-bus 2.8). Target 18.0, cap 20.0. The bundle report says "Zod in reader chunks: none ✅".
  - Shared lazy chunks: runtime-context 4.3, blueprint-host 6.5, blueprints 6.3, module-host 0.8 KB.
- **Android:**
  - `expo prebuild --platform android --clean --no-install` ✅
  - `gradlew :app:processReleaseMainManifest :app:compileReleaseKotlin` BUILD SUCCESSFUL. No KnReader warnings after switching to `UIManagerHelper.getEventDispatcher(context)`.
  - Merged release manifest: targetSdkVersion="36", allowBackup="false", `@xml/backup_rules` + `@xml/data_extraction_rules`, autoVerify="true", KnWriterWidgetProvider, `enableOnBackInvokedCallback` ×0.
  - Permissions: INTERNET, ACCESS_NETWORK_STATE, USE_BIOMETRIC, USE_FINGERPRINT, VIBRATE (0 restricted).
  - The `webkit-1.12.1.aar` has 0 `.so` / `jni` entries.
- **Final gates (main session, after the qa-runner fixes):** `pnpm check` ✅ 27 s (tsc ×3, ESLint 0 warnings, **118 files / 1,181 tests**, incl. blueprint, dna, guard, batch-a(+alchemy), batch-b ×3, i18n-parity) · `smoke.mjs` **30 ✅ / 0 ❌**, 634 s (21/21 engine×tier ×20 clean, Chrome Tide via v2 chat-thread, sheets 0 overflow, 0 console errors) · `writer:export` ✅ · `writer-shots.mjs` **175 ✅ / 0 ❌**, 196 s, incl. chained `smoke-publish.mjs` + tablet pack, every pack 0 console/page errors.

## 6. Visual Evidence & Reviewer Eyeball Checklist (`qa-shots-overhaul03/`)

1. `01-engines-batch1-dark-sheet.png`: 14 cards at 360 px, Noir Rain, dark.
   - Check that the redaction bars render as stark near-white blocks (ink token).
   - Check the vertical rhythm differences between cards (the cell label gap is sheet chrome).
2. `02-engines-batch1-light-sheet.png`: the same, on light paper.
   - Check the cool card vs warm page clash.
   - Check the light-mode accent legibility of the dashed meter border and the KESTREL labels.
3. `03-visual-dna-same-blueprint-4-books.png`: system-notification + police-dossier × 4 DNAs (after the `inherit` fix).
   - Ornaments now differ: brackets (Noir, Holo), filigree (Parchment), classification tab (Dossier).
   - Check that the OPEN stamp is the same orange in every book.
4. `04-calm-mode-and-writer-preview.png`: Writer Live Preview of Chrome Tide (Noir Rain) on High | after the tier bar → Reduced.
   - Check that the chat thread completes and calms (left: line 3 still pending → right: all three).
   - Flaw on show: the **v1 3D dice keep tumbling over the prose after → Reduced**, because legacy arms ignore live tier. That is OVERHAUL-04 `bespoke-3d` work.

## 7. Open Calls for OVERHAUL-04

1. Should Visual DNA also own the reading page (`--bg` / prose font), or only gimmick cards (today)? This decides the light-theme clash and Studio scope.
2. Ship `KnReaderWebView` as the Android transport behind a device-QA gate, or keep the single-file HTML until the 7 remaining engines (incl. `bespoke-3d` with three.js) land?
3. Blueprint delivery at 1,000+: per-genre lazy packs in the reader plus FTS5 metadata in the writer, or one R2 manifest with on-demand JSON per blueprint?
4. Retiring the v1 arms: should `audio-bed` and `bespoke-3d` (dice) keep v1 prop shapes via `LEGACY_CUES`, or migrate Chrome Tide's stored blocks to `blueprintId` cues once?
