# CLAUDE.md — Engineering Constitution & Guardrails

> **Read this file before writing a single line of code.**
> This repository powers a **modular linear kinetic novel platform**. The **Author** (human) handles 100% of writing and creative direction. **Claude** acts as Lead Engineer and VFX Artist.

---

## 1. The Core Mandate

Build a rock-solid, minimal platform with two tightly scoped apps and one clean plugin boundary:
1. **Native Mobile Writer (`apps/writer`):** A fast, offline-first phone app where the Author writes prose and configures kinetic gimmicks through auto-generated native GUIs—never writing code or markup.
2. **Browser Kinetic Reader (`apps/reader`):** A fast, zero-install PWA that renders crisp mobile-first typography and lazy-loads high-craft 3D/VFX/audio spectacles in the open screen space around the prose.
3. **Isolated Gimmick Modules (`packages/modules/*`):** Self-contained plugins that can be enabled, disabled, added, or deleted per novel without touching core code.

**The #1 historical failure mode of this project is scope creep.** Do not "helpfully" generalize this into a game engine. Simplicity, stability, and 60fps tactile craft beat feature count every single time.

---

## 2. The "NEVER BUILD" List (Hard Prohibitions)

Unless the Author explicitly amends this section in writing, **NEVER** design, stub, scaffold, or suggest any of the following:

- **NO branching narratives, choices, or story graphs** (no Passage graphs, FlowViews, exits, rooms, or open-world maps). Stories are strictly linear: `Book → Season → Chapter → Block`.
- **NO scripting, variables, state flags, or condition builders** (no `if/else` blocks, no expression evaluators, no quest logs).
- **NO RPG, combat, inventory, or minigame systems** (no stats, HP, enemies, items, skills, or minigame builders).
- **NO rhythm games, beatmaps, or ML/DSP audio pipelines** (no ONNX models, FFT beat trackers, stem separation, or Spotify/YouTube integrations).
- **NO desktop web Studio IDE** (all authoring happens in `apps/writer` on mobile; never recreate a multi-panel React IDE).
- **NO node-based shader graphs or keyframe sequencers** (every gimmick is purpose-coded cleanly inside its own isolated module folder).
- **NO custom text-markup syntax for the Author** (the Author never types `:::directive` or JSON; all gimmick controls are driven by declarative schemas rendered as native mobile forms).
- **NO heavy backend databases or mandatory reader logins** (published books are static JSON + optimized media served from CDN/R2; reader progress lives in `localStorage`).

---

## 3. Architectural Fences & Ownership Boundaries

```text
/
├── packages/
│   ├── core/              # FROZEN after Phase 1. Types, schema validator, plugin contract.
│   └── modules/           # ISOLATED plugins. One folder per gimmick (<genre>-<name>/).
├── apps/
│   ├── writer/            # Expo (React Native) native phone authoring app.
│   ├── reader/            # Vanilla TS + Vite PWA browser reader & Gimmick Sandbox.
│   └── publish-api/       # Tiny Cloudflare Worker handling authenticated R2 publishes.
├── CLAUDE.md              # This constitution.
├── DIRECTIVE.md           # Active phase or gimmick brief (your ONLY current scope).
└── PROJECT_PLAN.md        # Reference catalog (DO NOT pre-build items from here).
```

### Strict Boundary Rules
1. **Frozen Core Rule:** Adding, editing, or deleting a gimmick in `packages/modules/` MUST NEVER require changes to `packages/core/` or `apps/writer/`.
2. **Schema-Driven Mobile UI Rule:** `apps/writer` renders gimmick settings dynamically from each module's `schema.ts`. Never hand-code bespoke React Native screens for individual gimmicks unless explicitly requested by a Directive.
3. **Zero Heavy Imports in Writer:** `apps/writer` MUST NEVER import Three.js, physics engines (`cannon-es`/Rapier), GLSL shaders, or Web Audio renderers. It imports ONLY `meta`, `schema`, and `formatCardSummary` from a module. Live visual preview runs exclusively via the embedded WebView pointing at `apps/reader`.
4. **Per-Novel Tree-Shaking:** `apps/reader` MUST dynamically `import()` module renderers on demand based on `novel.json`'s `enabledModules[]`. If a novel does not enable `bl-dice-3d`, Three.js and physics MUST NOT be loaded for that novel.
5. **Single Shared WebGL Stage:** Never mount multiple concurrent `<canvas>` WebGL contexts. All `overlay-vfx` 3D/shader modules MUST mount onto the reader's singleton Transparent Stage Overlay (`position: fixed; inset: 0; pointer-events: none` unless explicitly interactive) and cleanly dispose of geometries, materials, and listeners on unmount.

---

## 4. The Mandatory 3-Part Module Contract

Every gimmick lives in `packages/modules/<module-id>/` and exports exactly three clean entry points:

```text
packages/modules/bl-dice-3d/
├── schema.ts      # Pure TS metadata, version, render layer, declarative GUI fields, defaults.
├── card.ts        # Pure TS 1-line human summary for the mobile writer pill.
├── renderer.ts    # Web-only lazy-loaded spectacle + mandatory reducedMotionFallback().
├── assets/        # Optional local .glb / textures / audio (strictly compressed).
└── index.ts       # Barrel exporting schema + card (NEVER re-exporting renderer.ts).
```

### Module Craft Standards (Non-Negotiable)
- **Scripted Physics Integrity:** Any physics spectacle whose visual outcome affects prose (dice, coins, roulette, cards) MUST support `mode: "scripted"` using invisible pre-simulation + UV/face remapping so real physics play out while guaranteeing the Author's chosen result lands cleanly.
- **3-Tier Performance & Accessibility:** Every `renderer.ts` MUST handle three tiers passed by the Stage:
  - `high`: Full 3D/WebGL/shader spectacle at 60fps on mid-range mobile GPUs.
  - `lite`: Lightweight 2D Canvas/CSS/SVG version for older phones or battery saver.
  - `reduced`: Respects `prefers-reduced-motion`—no strobes, no rapid screen shake, instant calm visual reveal with crisp typography/iconography.
- **Safe Margins:** Overlay spectacles MUST respect safe areas and prefer empty screen margins / pauses so they elevate the prose instead of making text unreadable.
- **Sensor Fallbacks:** Any gyroscope or shake trigger (`DeviceMotionEvent`) MUST always work seamlessly with a simple tap fallback on desktop and iOS Safari.
- **Strict Asset Budget:** Keep individual module JS + assets lightweight (aim for `< 300 KB` gzipped per module, excluding shared Three.js chunk). Always dispose GPU buffers on idle.

---

## 5. How We Work (Directive & Sandbox Workflow)

1. **Build ONLY what is in the active `DIRECTIVE.md`.** Treat `PROJECT_PLAN.md` as a menu for the future—never preemptively build unrequested modules, abstractions, or "just in case" hooks.
2. **Gimmick Sandbox First:** Every new gimmick MUST be registered in `apps/reader`'s standalone `/sandbox` route with live interactive controls generated from its `schema.ts` and a quality-tier switcher (`high` / `lite` / `reduced`). The Author reviews gimmicks directly on their phone via the Sandbox URL and gives creative feedback on weight, pacing, lighting, and sound.
3. **Keep Files Small & Readable:** Prefer clear, modular files (target `< 250 lines` per file) with strict TypeScript (`strict: true`, zero `any`).
4. **Verify Before Handing Off:** Before declaring a Directive task done, run typecheck, unit tests, production build, and verify zero console errors and clean bundle splitting (confirming core reader bundle stays `< 40 KB` gzipped without 3D modules).
5. **Ask, Don't Invent:** If a creative nuance is ambiguous (e.g., how fast a smoke wisp dissipates or whether a dice throw blocks scrolling), make a tasteful default, expose it as a simple schema control if useful, and flag the choice briefly in your handoff summary.
6. **One Report File Per Review Pass:** Every Orchestrator review pass gets its own new report at `docs/qa/pass-<n>-report.md`, plus a row in the `docs/qa/README.md` index. Never rewrite an earlier pass's report. Screenshots are attached to the handoff, not committed (`qa-shots*/` is git-ignored).

---

## 6. Approved Tech Stack

- **Monorepo:** `pnpm` workspaces + TypeScript (`strict: true`)
- **Validation:** `zod` (or lightweight zero-dep runtime validators) in `packages/core`
- **Mobile Writer (`apps/writer`):** Expo (React Native) + Expo Router + `expo-sqlite` / `expo-file-system` + `react-native-webview` + `expo-haptics`
- **Web Reader (`apps/reader`):** Vanilla TypeScript (or Preact strictly if shell state demands it) + Vite + `vite-plugin-pwa`
- **3D & Physics (Lazy Modules Only):** Tree-shaken `three` + `cannon-es`
- **Audio:** Native Web Audio API (simple playback, crossfades, stereo panning, low-pass filters—no DSP/ML)
- **Publishing (`apps/publish-api`):** Cloudflare Worker + Cloudflare R2 bucket (+ optional static GitHub archive export)