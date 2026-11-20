# DIRECTIVE 01 — Frozen Core, Module Contract, Reader Vertical Slice & Gimmick Sandbox

> **Scope Lock:** Execute **ONLY** the deliverables listed in this file. Do **not** build the Expo mobile app (`apps/writer`), the Cloudflare publish worker (`apps/publish-api`), or any unrequested gimmick modules yet. Follow every guardrail in `CLAUDE.md`.

---

## 1. Objective

Establish the clean monorepo foundation, lock the **Frozen Core** data schema (`Book → Season → Chapter → Block`) and **3-Part Module Contract**, build a razor-fast **Browser Kinetic Reader** vertical slice with a shared **Transparent WebGL Stage**, and prove the entire modular spectacle architecture on mobile browsers via a **Gimmick Sandbox** featuring three foundational modules—culminating in our flagship **`bl-dice-3d`** 3D physics throw.

---

## 2. Deliverables

### Deliverable A: Clean Monorepo Skeleton

Set up a `pnpm` workspace with strict TypeScript, Prettier, ESLint, and Vitest:

```text
/
├── packages/
│   ├── core/
│   └── modules/
│       ├── core-ambient-bed/
│       ├── gits-cyberbrain-chat/
│       └── bl-dice-3d/
├── apps/
│   └── reader/
├── sample-novels/
│   └── vertical-slice/          # Demo book exercising Seasons → Chapters → Blocks + all 3 modules
├── package.json
└── pnpm-workspace.yaml
```

### Deliverable B: `packages/core` (Frozen Schema & Plugin Contract)

Implement pure, zero-DOM TypeScript definitions and runtime validators for:

1. **Content Hierarchy (`schema.ts`):**
   - `NovelManifest`: `schemaVersion`, `id`, `title`, `subtitle`, `author`, `sectionLabel` (`"Season"` | `"Volume"` | `"Arc"`), `theme` (CSS token overrides), `enabledModules: string[]`, `seasons: string[]`.
   - `SeasonManifest`: `id`, `title`, `subtitle`, `accentColor`, `chapters: string[]`.
   - `ChapterDocument`: `id`, `seasonId`, `title`, `status` (`"draft"` | `"unlisted"` | `"published"`), `blocks: Block[]`.
   - `Block` (discriminated union with stable ULID `id` on every block):
     - `ProseBlock`: `{ id, kind: "prose", text, style?: "body" | "whisper" | "emphasis", beatStop?: boolean }`
     - `DialogueBlock`: `{ id, kind: "dialogue", speaker, text, accentColor?, beatStop?: boolean }`
     - `SceneBreakBlock`: `{ id, kind: "scene-break", label?, timestamp?, beatStop?: boolean }`
     - `ModuleBlock`: `{ id, kind: "module", moduleId: string, moduleVersion: number, props: Record<string, unknown>, beatStop?: boolean }`

2. **Declarative Module GUI Field Schema (`module-contract.ts`):**
   Design the field descriptor union that will drive BOTH the `/sandbox` controls now and the Expo native mobile bottom sheet in Phase 2:
   - Supported field types: `text`, `multiline`, `number` (with `min`, `max`, `step`), `toggle`, `select` (with labeled chips/options), `multi-select`, `color`, `string-list`, `number-list`, `asset` (`audio` | `image` | `model`).
   - Optional `showWhen` simple equality condition (e.g., show `scriptedNumbers` field only when `outcomeMode === "scripted"`).
   - `ModuleMeta`: `id`, `version`, `name`, `genre` (`"core"` | `"gits"` | `"black-lagoon"` | `"psych-thriller"`), `icon`, `layer` (`"backdrop"` | `"inline"` | `"overlay-vfx"` | `"audio-haptic"`), `description`.
   - `ModuleSchemaDefinition`: `{ meta, fields, defaults, validate(props) }`.
   - `ModuleCardFormatter`: `(props) => { title: string; subtitle: string; badge?: string }`.
   - `ModuleRenderer`: Web-only interface with `preload?()`, `mount(ctx)`, `trigger?()`, `update?(props)`, `dispose()`, plus explicit handling for `tier: "high" | "lite" | "reduced"`.

3. **Unit Tests:** Validate sample novel/season/chapter parsing, malformed payload rejection, and module default filling.

### Deliverable C: `apps/reader` (Mobile-First Kinetic Reader + Shared Stage)

Build a fast, zero-bloat Vanilla TypeScript + Vite PWA reader:

- **Core Shell:**
  - Bookshelf → Season/Volume list → Chapter list → Reading view.
  - Clean, high-legibility typography controls (font size, warm/dark/obsidian reading themes, quality tier toggle `Auto / High / Lite / Reduced Motion`).
  - Zero-login `localStorage` bookmarking (restores `novelId`, `seasonId`, `chapterId`, `blockId`) + deep-link URL hash (`#b-<blockId>`).
- **Hybrid Pacing Engine:**
  - Smooth vertical reading stream where blocks reveal naturally as you scroll—**plus** optional `beatStop: true` blocks that gently pause progression with a subtle tap-to-continue cue so dramatic spectacles land cleanly.
  - First-tap **Audio Unlock Curtain** ("Start Chapter · Sound On / Silent") that cleanly unlocks Web Audio on iOS Safari and Android Chrome.
- **Singleton Transparent Stage (`stage.ts`):**
  - Mounts a single shared transparent Three.js WebGL renderer (`position: fixed; inset: 0`) **lazily** only when an `overlay-vfx` module is active, and automatically disposes/suspends after idle timeout to protect mobile battery.
  - Exposes viewport world-bounds helpers so 3D physics objects bounce naturally inside the visible screen margins.
- **Dynamic Module Registry (`registry.ts`):**
  - Resolves `moduleId` via dynamic `import()` so unused modules and Three.js are never downloaded on chapters that don't use them.
- **Audio Bus (`audio-bus.ts`):**
  - Lightweight Web Audio controller supporting looping ambient crossfades, ducking, and crisp one-shot SFX playback.

### Deliverable D: Standalone Gimmick Sandbox (`/sandbox`)

Build a dedicated `/sandbox` route inside `apps/reader` designed for phone testing:

- Dropdown to pick any registered module.
- **Auto-generated control panel** rendered directly from the module's `schema.ts` fields (proving the schema-driven UI model before Phase 2).
- Quality-tier switcher (`High` / `Lite` / `Reduced`) and a prominent **"Trigger Beat"** button over sample prose paragraphs so the Author can test spectacle readability, weight, shadows, and 60fps performance directly on their phone.

### Deliverable E: Three Proof-of-Concept Modules

1. **`core-ambient-bed` (`audio-haptic`)**
   - Smoothly crossfades looping ambient audio (use subtle procedural Web Audio rain/barroom hum fallbacks for the demo so it works with zero external copyrighted MP3s) with volume and fade-duration controls.
2. **`gits-cyberbrain-chat` (`inline`)**
   - Translucent Section-9 style encrypted thought-link message thread with sender ID, encryption badge (`AES-Q` / `OPEN` / `SPOOFED`), subtle vector borders, and soft neural chime SFX.
3. **`bl-dice-3d` (`overlay-vfx`) — Flagship Spectacle Proof-of-Concept**
   - Throws 1–3 realistic 3D dice (`d6` with rounded bevels, recessed pips, and crisp PBR materials: `Ivory`, `Casino Red`, `Brushed Brass`, `Obsidian`) across the open screen space using Three.js + `cannon-es`.
   - **Real Physics, Scripted Outcome:** When `outcomeMode === "scripted"`, pre-simulate the rigid-body throw invisibly in memory until all dice settle, detect each die's top-facing local normal, remap/rotate the die mesh faces so the Author's exact scripted numbers (`e.g., [1, 1]` or `[6, 6]`) land cleanly face-up, then play back the authentic physical bounces, wall ricochets, soft contact shadows on an invisible shadow-catcher plane, and synthesized clatter SFX.
   - **Interactions:** Supports `trigger: "auto"` or `trigger: "tap-or-shake"` (using `DeviceMotionEvent` with graceful tap button fallback).
   - **Clean Exit:** Holds settled dice clearly readable for a configurable beat, then gently fades/lifts away without leaving stray DOM or GPU memory.
   - **Tiers:** `high` = full 3D PBR + soft shadows; `lite` = crisp 2D canvas tumbled dice; `reduced` = calm tactile die-face reveal badge with zero motion.

### Deliverable F: Vertical Slice Demo Chapter (`sample-novels/vertical-slice/`)

Create a short, atmospheric 12-block demo chapter (1 Season, 1 Chapter) combining crisp prose, dialogue, `core-ambient-bed`, `gits-cyberbrain-chat`, and two `bl-dice-3d` throws (one scripted `[1, 1]` snake eyes, one interactive tap/shake `[6, 6]`) so the Author can immediately test the reader and sandbox on their phone.

---

## 3. Explicitly Out of Scope for Phase 1

- **Do NOT** scaffold `apps/writer` (Expo mobile app is Phase 2).
- **Do NOT** build `apps/publish-api` or R2/GitHub sync (Phase 3).
- **Do NOT** build any other gimmicks from `PROJECT_PLAN.md` yet.
- **Do NOT** build user accounts, comments, analytics, or theming editors.

---

## 4. Acceptance Criteria (Definition of Done)

1. `pnpm typecheck`, `pnpm test`, and `pnpm build` all pass with zero warnings or errors.
2. Production bundle inspection confirms `apps/reader`'s initial core JS chunk (without 3D modules) is **`< 40 KB` gzipped**, and `three` + `cannon-es` live strictly in lazy-loaded chunks.
3. Opening the demo chapter on mobile Chrome/Safari loads immediately, unlocks audio on first tap, respects `beatStop`, and executes `bl-dice-3d` at smooth 60fps with exact scripted numbers landing face-up every single time.
4. Opening `/sandbox` allows live tweaking of every `bl-dice-3d` schema property (material, count, scripted values, trigger mode) and switching between `High`, `Lite`, and `Reduced` tiers cleanly with zero WebGL leaks across 20 consecutive triggers.
5. Zero edits to `packages/core` are needed to register or remove a module.
