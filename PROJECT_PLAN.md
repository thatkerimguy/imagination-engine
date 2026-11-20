# Kinetic Novel Platform — Master Project Plan & Genre Gimmick Catalog

> **Core Mission:** Write linear, high-craft kinetic novels anywhere from a purpose-built native mobile editor with zero code friction, and publish them as effortlessly accessible, spectacle-rich web reading experiences—powered by a tiny frozen core and swappable, modular gimmick packs.

---

## 1. Vision & Scope Guardrails

This platform exists to replace sprawling game-engine complexity with a **writer-first novel system**. The target reader includes people who normally bounce off walls of static white-on-black prose: they get crisp, mobile-first pacing punctuated by tactile, cinema-grade micro-spectacles (3D physics objects tumbling across empty screen space, diegetic UI intrusions, psychological text subversion, atmospheric shifts, and spatial audio).

### The Non-Negotiable Charter (Anti-Scope-Creep Rules)
1. **Linear Novel First, Never a Game Engine:** No branching story graphs, no variable/condition editors, no RPG stats, no inventories, no turn-based combat, and no rhythm beatmaps. Every story is strictly `Book → Season/Volume → Chapter → Block`.
2. **Writing Never Feels Like Coding:** Authors never write raw syntax, markup directives, or scripts. Every gimmick exposes a declarative schema that auto-generates a native mobile bottom-sheet GUI (pickers, toggles, sliders, short text inputs).
3. **Frozen Core, Disposable Modules:** The core reader and editor only understand books, seasons, chapters, prose blocks, and a generic `module` block slot. Every gimmick lives in an isolated plugin folder. Removing or adding a gimmick between novels never touches core code.
4. **Spectacle Lives Only in the Web Renderer:** The phone editor stays ultra-fast and lightweight by showing clean interactive pills/cards for gimmicks, launching the real WebGL/VFX renderer only on demand via an in-app preview WebView.
5. **Accessible by Default:** Readers open a link in any mobile or desktop browser—zero app installs, fast initial load, graceful fallbacks for low-end devices and `prefers-reduced-motion`.

---

## 2. Lifecycle Decision Register

Every major decision the project will face from Day 1 through multi-novel maintenance, organized by phase. Treat each item as a deliberate gate to lock in before building the corresponding subsystem.

### Phase 0: Foundation & Data Architecture

| ID | Decision Point | Options to Weigh | Recommended Default | Key Tradeoff |
| :--- | :--- | :--- | :--- | :--- |
| **D-01** | **Repo Strategy** | A) Gut existing `imagination-engine` repo in place<br>B) Archive old repo (`v-engine-archive`) and start a clean monorepo, cherry-picking only `apps/player` shell/PWA/typography | **Option B (Fresh Repo + Selective Salvage)** | Avoids months of untangling 700+ ghost dependencies while preserving the clean vanilla PWA player shell. |
| **D-02** | **Canonical Hierarchy** | Fixed 3-level tree (`Season/Volume → Chapter → Block`) vs. flexible nested folders | **Fixed 3-level tree** (`Book → Season → Chapter → Block`) with optional `label` ("Season" vs. "Volume" vs. "Arc") per book | Keeps mobile navigation, TOC UI, and URLs (`/book/s1/ch04`) clean and predictable. |
| **D-03** | **Source-of-Truth Data Format** | A) Structured JSON per chapter (`ch-01.json`)<br>B) Markdown + custom directive blocks<br>C) SQLite binary DB only | **Option A (Human-readable JSON per chapter)**, stored locally in SQLite/FS on mobile and exported as static JSON on publish | Native GUI editors map 1:1 to JSON blocks without fragile custom parsers; diffs cleanly in Git. |
| **D-04** | **Block Identity & Ordering** | Array index vs. stable UUID/ULID per block | **Stable ULID per block** inside an ordered array | Enables reliable bookmarks, preview jump-to-block, and future comments/translations without breaking indices on edits. |
| **D-05** | **Schema Versioning** | Unversioned JSON vs. explicit `schemaVersion` + per-module `version` | **Explicit semver** on both `novel.json` and every module block | Lets Book 1 stay frozen on `dice-3d@1` while Book 2 upgrades to `dice-3d@2`. |
| **D-06** | **Asset Ownership** | Shared global asset pool vs. per-novel asset bundle (`assets/audio`, `assets/models`, `assets/img`) | **Per-novel folders + optional shared pack assets** (e.g., standard 3D dice meshes in the module package) | Keeps individual novels portable and easy to archive without breaking other books. |

### Phase 1: Modular Gimmick Architecture

| ID | Decision Point | Options to Weigh | Recommended Default | Key Tradeoff |
| :--- | :--- | :--- | :--- | :--- |
| **D-07** | **Module Contract Anatomy** | Monolithic switch-case in core vs. strict 3-part plugin manifest (`meta + schema`, `editorCard`, `webRenderer`) | **Strict 3-part plugin package** (`packages/modules/<id>/`) | Enforces clean separation: mobile app imports only `meta + schema`; web reader lazy-imports `webRenderer`. |
| **D-08** | **Per-Novel Module Activation** | All modules loaded globally vs. explicit `enabledModules: [...]` list in `novel.json` | **Explicit per-novel manifest** | Phone editor toolbar only shows relevant gimmicks for the active book; web bundler tree-shakes unused modules and Three.js completely. |
| **D-09** | **Rendering Layers** | Everything inline in DOM vs. 4 standardized stage layers | **4 Standardized Layers:**<br>1. `backdrop` (full-bleed behind text)<br>2. `inline` (flows inside reading column)<br>3. `overlay-vfx` (transparent fixed WebGL/Canvas over empty screen space)<br>4. `audio-haptic` (non-visual bus) | Prevents z-index wars and lets 3D objects (dice, shell casings, pill bottles, holograms) interact with viewport margins cleanly. |
| **D-10** | **Determinism for Narrative Integrity** | True RNG on playback vs. author-scripted outcomes with real physics | **Dual-mode (`Scripted` default, `True Random` optional)** | Uses invisible pre-simulation + UV/face-remapping so physics look 100% real while always landing on the exact story-critical result. |
| **D-11** | **WebGL Context Strategy** | One WebGL canvas per block vs. single shared singleton Transparent Stage mounted on demand and disposed after idle | **Single shared Transparent Stage** | Mobile browsers hard-cap active WebGL contexts (~8); a shared stage avoids crashes and saves battery. |
| **D-12** | **Device Performance & Accessibility Tiers** | Single heavy mode vs. automatic 3-tier quality scaling (`High 3D` / `Lite 2D` / `Reduced Motion`) | **3-tier auto-scaling + reader toggle** | Guarantees mid-range phones hit 60fps and readers sensitive to flicker/shake still get clean stylistic fallbacks. |

### Phase 2: Native Mobile Authoring App

| ID | Decision Point | Options to Weigh | Recommended Default | Key Tradeoff |
| :--- | :--- | :--- | :--- | :--- |
| **D-13** | **Mobile Framework** | A) **Expo (React Native)**<br>B) Capacitor (Web wrapper)<br>C) Flutter | **Expo (React Native + TypeScript)** | Shares exact TypeScript module schemas directly with the web reader while delivering true native keyboard, scrolling, and haptics. |
| **D-14** | **Writing Canvas Ergonomics** | Separate modal per paragraph vs. seamless continuous prose flow where Enter creates beats and a sticky `+` bar inserts gimmicks | **Continuous native prose stream + sticky keyboard accessory bar** | Preserves Apple Notes / Obsidian writing speed; gimmicks appear as compact, tappable pills inline between paragraphs. |
| **D-15** | **Gimmick Editor GUI Generation** | Hand-coding a screen for every gimmick vs. schema-driven form renderer (chips, toggles, sliders, color swatches, audio/image pickers) | **Schema-driven native bottom sheet** (with rare escape hatch for custom micro-pickers) | Adding a brand-new gimmick requires **zero mobile app UI code**—just define its schema fields. |
| **D-16** | **Live Spectacle Preview on Phone** | Re-implementing WebGL in React Native vs. embedded local WebView running the actual Web Reader at the active block | **Embedded WebView Bridge** | 100% WYSIWYG fidelity—what you preview on your phone is pixel-identical to what browser readers see. |
| **D-17** | **Offline Storage & Backup** | Cloud-only vs. Local-first SQLite/FS + automatic snapshot history + optional Git/cloud sync | **Local-first with automatic chapter snapshots** | Write on flights or trains with zero connectivity; impossible to lose a draft to a flaky connection. |
| **D-18** | **Cross-Device Writing (Future-Proofing)** | Phone-only forever vs. phone-first with optional tablet/desktop sync | **Git/R2 JSON sync format from Day 1** | Even if you start phone-only, clean JSON storage lets you open the same novel on an iPad or laptop later with zero migration. |

### Phase 3: Browser Reader & Spectacle Runtime

| ID | Decision Point | Options to Weigh | Recommended Default | Key Tradeoff |
| :--- | :--- | :--- | :--- | :--- |
| **D-19** | **Reader Web Stack** | Vanilla TypeScript + Vite PWA (salvaged from `apps/player`) vs. Preact/Svelte | **Vanilla TS + Vite PWA** (or lightweight Preact if shell UI grows) | Sub-30 KB core JS payload; prose loads instantaneously before heavy modules ever download. |
| **D-20** | **Reading Pacing Mode** | A) Pure scroll (webtoon-style)<br>B) Tap-to-advance beat-by-beat (kinetic novel)<br>C) Hybrid (scroll freely, optional tap-lock on key spectacle beats) | **Option C (Hybrid: Scrollable Stream with Optional Beat-Stops)** | Avoids annoying fast readers while letting dramatic reveals (a gunshot, a dice roll, a breach) hold tension until tapped. |
| **D-21** | **3D & Physics Stack** | Three.js + `cannon-es` vs. Three.js + Rapier (WASM) vs. Babylon.js | **Three.js (tree-shaken) + `cannon-es`** (or Rapier if complex mesh collisions are needed) | Smallest footprint for crisp 3D props (dice, casings, keys, pill bottles, holograms) on mobile GPUs. |
| **D-22** | **Mobile Audio Autoplay Unlock** | Assume audio works vs. subtle "Enter with Sound / Silent" chapter curtain on first tap | **First-tap audio unlock pill** (remembers user preference) | iOS Safari and Android Chrome block audio until a user gesture; integrating unlock into the "Start Chapter" tap makes audio seamless. |
| **D-23** | **Reader Progress & Bookmarks** | User accounts/login required vs. zero-friction `localStorage` + shareable URL hash (`#b-01J...`) | **Zero-login `localStorage` + deep-link block hashes** | Eliminates signup drop-off; readers can still pick up right where they left off or share an exact moment. |
| **D-24** | **Sensor Interactions (Gyro / Shake / Haptics)** | Mandatory vs. strictly optional enhancement with tap fallback | **Opt-in enhancement + Tap fallback always present** | Desktop readers and iOS Safari users (who must approve `DeviceMotionEvent`) never get soft-locked. |

### Phase 4: Publishing, Media & Distribution

| ID | Decision Point | Options to Weigh | Recommended Default | Key Tradeoff |
| :--- | :--- | :--- | :--- | :--- |
| **D-25** | **One-Tap Phone Publish Pipeline** | A) App commits JSON/assets via GitHub REST API → GitHub Actions deploys Cloudflare Pages<br>B) App uploads directly to Cloudflare R2 via authenticated Worker API | **Option B (Cloudflare Worker + R2)** for instant 2-second publishes, with optional GitHub mirror for archival backup | Publishing a typo fix from your phone goes live immediately without waiting 2 minutes for a CI build. |
| **D-26** | **Draft vs. Live Workflow** | Direct edit to live vs. explicit `Draft` / `Unlisted Preview Link` / `Published` status per chapter | **3-state Chapter Lifecycle** | Lets you send a private preview link to beta readers from your phone before pushing a chapter public. |
| **D-27** | **Media Optimization Pipeline** | Raw phone uploads vs. automated compression on publish (WebP/AVIF images, Opus/MP3 audio, Draco `.glb` 3D models) | **Auto-optimize on upload** (client-side for images, Worker/build script for assets) | Keeps chapter loads snappy on cellular connections (target `< 1.5 MB` per chapter including audio). |
| **D-28** | **Reader Analytics & Privacy** | Heavy third-party trackers vs. privacy-first chapter completion & drop-off counters (Cloudflare Web Analytics / Worker counts) | **Privacy-first aggregate metrics only** | Shows you which chapters hook reluctant readers and where pacing drags without creepy tracking banners. |

### Phase 5: Multi-Novel Lifecycle & Evolution

| ID | Decision Point | Options to Weigh | Recommended Default | Key Tradeoff |
| :--- | :--- | :--- | :--- | :--- |
| **D-29** | **Multi-Book Portal vs. Standalone Domains** | Single hub site hosting all novels (`/glass-harbor`, `/roanapur-blues`) vs. separate repo per novel | **Single Reader Engine + Multi-Book Shelf** (with custom theme CSS variables & optional custom domain per book) | Maintain one rock-solid reader codebase while giving every novel its own distinct visual identity and module loadout. |
| **D-30** | **Cutting / Archiving Modules** | Deleting a module breaks older novels vs. immutable built module bundles cached per version | **Versioned module bundles** (`modules/dice-3d/v1.js`) | You can retire a gimmick from the active editor palette for new books while older published novels keep working forever. |
| **D-31** | **Monetization / Access (Optional Future)** | Always free vs. free web + optional Supporter/Early-Access chapter tokens | **Free public core, optional token-gated early chapters** | Keeps accessibility maximum while leaving an easy path to support ongoing seasons. |

---

## 3. Technical Blueprint: Shared Core & Plugin Contract

### Data Hierarchy (`Book → Season → Chapter → Block`)
```text
novels/
└── chrome-tide/
    ├── novel.json                # Metadata, theme tokens, enabledModules[], season order
    ├── assets/                   # Images, audio loops, custom 3D props
    └── seasons/
        └── s01/
            ├── season.json       # Title, subtitle, cover, chapter order
            ├── ch01.json         # Ordered array of Blocks (prose + module blocks)
            └── ch02.json
```

### Module Plugin Interface (Conceptual)
Every gimmick module exports three clean surfaces:
1. **`schema.ts` (Shared):** Module ID, display name, genre tag, icon, render layer, and declarative field definitions (`select`, `number`, `toggle`, `text`, `list`, `color`, `asset`) that auto-render the native mobile GUI.
2. **`card.ts` (Mobile Editor):** A 1-line human summary formatter (e.g., `🎲 2× D6 · Obsidian · Scripted [1, 1]`) so chapters read cleanly in the editor.
3. **`renderer.ts` (Web Only, Lazy-Loaded):** Lifecycle hooks (`preload()`, `mount(stage, props, tier)`, `trigger()`, `dispose()`) plus a mandatory `reducedMotionFallback()`.

### Core Universal Modules (Always Available Across All Novels)
Before genre packs, every novel shares **6 tiny core blocks**:
1. `prose` — Clean typographic paragraph with subtle emphasis and optional beat-stop.
2. `dialogue` — Clean speaker-attributed exchange with optional avatar/color accent.
3. `scene-break` — Paced atmospheric divider (time/location stamp, silence beat).
4. `ambient-bed` — Seamless crossfading background ambience/music track with ducking.
5. `sfx-cue` — One-shot spatial or stereo sound effect tied to a block reveal.
6. `media-frame` — Full-bleed or inline artwork/video loop with subtle Ken Burns or parallax motion.

---

## 4. Phased Build Roadmap

1. **Milestone 1 — Frozen Core & Vertical Slice (Weeks 1–3):**
   - Lock `Book → Season → Chapter → Block` JSON schema + plugin contract.
   - Build minimal Vite PWA Web Reader + Gimmick Sandbox (`/sandbox`).
   - Build **3 Proof-of-Concept Modules**: `core-ambient-bed`, `gits-cyberbrain-chat`, and **`bl-dice-3d`** (proving the Transparent WebGL Stage + pre-simulated scripted physics).
2. **Milestone 2 — Native Mobile Writer Alpha (Weeks 4–7):**
   - Expo React Native app: Bookshelf → Season/Chapter Tree → Continuous Prose Writer.
   - Schema-driven bottom-sheet gimmick editor + inline gimmick pills.
   - Embedded WebView live preview button jumping straight to the active block.
3. **Milestone 3 — One-Tap Publish & Pilot Chapter (Weeks 8–9):**
   - Cloudflare Worker + R2 publish button inside the phone app.
   - Write, polish, and publish a full 10-minute pilot chapter directly from your phone to test real-world pacing on friends who don't normally read books.
4. **Milestone 4 — Genre Gimmick Pack Production (Ongoing, On-Demand):**
   - Commission gimmicks from Claude **only as your actual chapters call for them** (2–3 modules per chapter), pulling specs directly from the catalogs below so you never fall back into speculative engine-building.

---

## 5. Genre Gimmick Catalog A — *Ghost in the Shell* Style (28 Modules)
**Aesthetic Pillars:** Cyberbrain UX, tactical post-cyberpunk espionage, sterile megacity rain, optical AR telemetry, ghost-hacking, transhumanist identity drift, crisp cyan/amber/monochrome vector precision, clinical yet eerie.

### Cluster A1: Cyberbrain & Neural Interface (6 Modules)

1. **`gits-cyberbrain-chat` — Silent Thought-Link Thread**
   - **Spectacle:** Encrypted telepathic messages slide into the screen's side margin as translucent, razor-thin HUD callouts with sub-audible neural ping pulses and live signal-strength jitter, keeping the main physical prose visible beside them.
   - **Mobile GUI:** Sender ID, encryption badge (`AES-Q` / `OPEN` / `SPOOFED`), side (`Left` / `Right`), message lines, chime tone.
   - **Layer:** `inline` / `overlay-dom` + `audio-haptic`.

2. **`gits-ghost-whisper` — Subliminal Ghost-Line Overlay**
   - **Spectacle:** A faint, slightly out-of-phase secondary line of text drifts behind the primary prose like an intrusive thought or memory echo—only snapping into crisp focus if the reader gently tilts their phone (gyroscope) or holds a finger on the paragraph.
   - **Mobile GUI:** Primary visible line, hidden ghost-whisper text, reveal mode (`Hold` / `Tilt` / `Auto-drift`), opacity.
   - **Layer:** `inline` (CSS/Shader + optional gyro).

3. **`gits-neural-firewall` — Intrusion Barrier Lock**
   - **Spectacle:** A sleek hexagonal wireframe barrier materializes over the empty screen margins as a hack attempt hits; concentric rings fracture and flash amber-to-crimson as the reader taps through the tension beats, shattering into floating vector shards when breached.
   - **Mobile GUI:** Barrier state (`Holding` / `Cracking` / `Breached`), color palette (`Section-9 Cyan` / `Ice Amber` / `Redline`), shatter beat toggle.
   - **Layer:** `overlay-vfx` (Transparent WebGL/Three.js).

4. **`gits-sensory-sync` — Shared-Senses Split Feed**
   - **Spectacle:** Smoothly splits the reading column into dual synchronized feeds (`[LOCAL OPTICS]` vs. `[REMOTE LINK]`) with subtle chromatic offset, letting two characters' simultaneous perceptions play side by side before snapping back to one perspective.
   - **Mobile GUI:** Left feed label & text, right feed label & text, sync drift intensity slider.
   - **Layer:** `inline` (DOM + CSS).

5. **`gits-memory-rewrite` — Live False-Memory Scrub**
   - **Spectacle:** As the reader finishes a paragraph, specific key nouns silently glitch, scrub through hex/kanji glyphs, and rewrite themselves into altered "implanted" facts right before their eyes—leaving them questioning what they just read.
   - **Mobile GUI:** Original phrase, rewritten phrase, trigger delay (seconds or on-scroll-back), glitch style (`Clinical` / `Corrupted`).
   - **Layer:** `inline` (DOM kinetic typography).

6. **`gits-vitals-hud` — Prosthetic Biometric Strip**
   - **Spectacle:** Pins a whisper-thin cybernetic telemetry header to the top edge of the viewport (heart rate / sync ratio / adrenaline / prosthetic load) that organically spikes, flatlines, or desyncs as chapters escalate, then cleanly dismisses.
   - **Mobile GUI:** Mode (`Enable` / `Update` / `Clear`), BPM, sync %, alert state (`Nominal` / `Elevated` / `Critical`), custom metric label.
   - **Layer:** `overlay-dom` + subtle pulse audio.

### Cluster A2: Tactical Optics, AR & Surveillance (6 Modules)

7. **`gits-optic-reticle` — Target Lock & Threat Analysis**
   - **Spectacle:** A crisp 3D-projected AR targeting reticle glides across empty screen space, locks onto a character name or portrait with spring physics, and unfurls a minimalist kinetic callout tag (`ID: UNVERIFIED · CYBERIZATION 82% · ARMED`).
   - **Mobile GUI:** Target title, 3 short telemetry tags, threat color (`Neutral` / `Hostile` / `VIP`), lock-on SFX.
   - **Layer:** `overlay-vfx` (Canvas/SVG + Web Audio).

8. **`gits-thermo-optics` — Thermoptic Camouflage Uncloak**
   - **Spectacle:** A hidden paragraph, silhouette, or artwork sits rendered in shimmering glass-like refraction ripples against the background; tapping or scrolling peels away the optical camouflage wave-front to reveal what was standing right in front of the reader.
   - **Mobile GUI:** Hidden content (text or image), cloak tint (`Clear Glass` / `Rain Distortion`), reveal trigger (`Tap` / `Scroll Scrub`).
   - **Layer:** `inline` (WebGL refraction shader / CSS fallback).

9. **`gits-cctv-intercept` — Hijacked Surveillance Feed**
   - **Spectacle:** Inserts a crisp diegetic security-cam frame with rolling timecode, lens distortion, camera ID (`SECTOR 04 // CAM-19`), and subtle infrared grain—supporting either an image, silent looping video clip, or live-typed transcript overlay.
   - **Mobile GUI:** Media asset, camera ID, timestamp, lens filter (`IR Night` / `Thermal` / `Raw CCTV`), caption line.
   - **Layer:** `inline` (Canvas shader + DOM).

10. **`gits-spatial-blueprint` — 3D Rotating Building / Room Wireframe**
    - **Spectacle:** Floats a crisp translucent cyan 3D architectural wireframe (or tactical prop schematic) in empty screen space that slowly rotates as you scroll—highlighting entry points, sniper sightlines, or server vaults with glowing pins.
    - **Mobile GUI:** 3D model preset or `.glb` asset, highlight pin labels (up to 4), wire color, allow finger-drag orbit toggle.
    - **Layer:** `overlay-vfx` / `inline` (Three.js wireframe shader).

11. **`gits-ballistic-arc` — Tactical Trajectory Simulation**
    - **Spectacle:** Draws clean glowing parabolic calculation lines across the screen margins with live windage/distance readouts (`DIST 412M · WIND 3.2M/S · IMPACT 0.48S`), snapping into a brief freeze-frame flash at the moment of the shot.
    - **Mobile GUI:** Distance text, wind/angle telemetry, arc direction (`Left-to-Right` / `Top-Down`), impact flash toggle.
    - **Layer:** `overlay-vfx` (2D Canvas).

12. **`gits-voice-print` — Real-Time Audio Waveform & Spectrogram**
    - **Spectacle:** Renders a razor-sharp reactive oscilloscope / frequency analyzer bar synchronized to a whispered voice clip, intercepted phone call, or synthetic AI speech—with live subtitle highlights locked to the audio cadence.
    - **Mobile GUI:** Audio clip, speaker designation, waveform style (`Oscilloscope` / `Bars` / `Circular`), transcript text.
    - **Layer:** `inline` (Web Audio AnalyserNode + Canvas).

### Cluster A3: Net-Diving, Hacking & Data Warfare (6 Modules)

13. **`gits-net-dive` — Seamless Dive-In Perspective Tunnel**
    - **Spectacle:** Triggers a smooth 2-second 3D wireframe data-tower tunnel rushing outward from behind the text as the protagonist jacks into the Net, transitioning the reader's entire background theme from rainy urban slate into deep cyber-space obsidian and glowing grid lines.
    - **Mobile GUI:** Direction (`Dive In` / `Surface Out`), grid palette (`Emerald` / `Cobalt` / `Amber`), transition speed, hum SFX.
    - **Layer:** `backdrop` (Three.js / GLSL shader) + theme shift.

14. **`gits-redacted-decrypt` — Live Clearance Decryption**
    - **Spectacle:** Presents a classified government/corporate memo with heavy black redaction bars; tapping or reaching the beat sweeps a glowing scanline across the document, live-cracking the bars into exposed text with rapid cryptographic character rolls.
    - **Mobile GUI:** Classification header (`TOP SECRET // SECTION 9`), full text with tap-highlighted redacted spans, decryption speed.
    - **Layer:** `inline` (DOM kinetic sweep).

15. **`gits-daemon-swarm` — 3D Floating Data Cubes & Ice Nodes**
    - **Spectacle:** Translucent geometric 3D polyhedra (representing search daemons or security ICE) drift lazily in the open screen margins around the text—orbiting smoothly during calm investigation or darting aggressively across the viewport during a cyber-chase.
    - **Mobile GUI:** Swarm density (`Sparse` / `Dense`), behavior (`Orbit` / `Hunt` / `Scatter`), node geometry (`Cubes` / `Octahedra`), color.
    - **Layer:** `overlay-vfx` (Three.js instanced meshes).

16. **`gits-packet-trace` — Global Node Hop Map**
    - **Spectacle:** Projects a sleek minimalist dark-mode vector map or network constellation where glowing trace arcs hop rapidly across proxy cities (`NEW PORT → SINGAPORE → ZURICH → [ORIGIN MASKED]`), syncing each hop with tense synth pings.
    - **Mobile GUI:** Ordered list of 2–6 proxy node names, trace outcome (`Locked` / `Lost Signal`), tempo.
    - **Layer:** `inline` (SVG/Canvas animated path).

17. **`gits-code-cascade` — Peripheral Hex/Log Bleed**
    - **Spectacle:** Subtle, ultra-low-opacity system logs, memory addresses, or protocol handshakes trickle quietly along the far outer edges of the viewport—never obscuring prose, just saturating the periphery with machine presence.
    - **Mobile GUI:** Preset (`Kernel Panic` / `Trace Active` / `Neural Sync` / `Custom`), intensity (`Whisper` / `Heavy`), duration.
    - **Layer:** `backdrop` (Canvas text strip).

18. **`gits-spoof-inject` — Fake System Notification Takeover**
    - **Spectacle:** Drops a convincingly clean, diegetic OS/Cyberbrain alert banner from the top of the reader viewport (`WARNING: UNAUTHORIZED GHOST ACCESS DETECTED` or a forged corporate alert) that slides away or lets the reader dismiss it to keep reading.
    - **Mobile GUI:** Alert title, subtitle, severity (`Info` / `Warning` / `Breach`), auto-dismiss seconds or tap-to-dismiss.
    - **Layer:** `overlay-dom` + haptic buzz.

### Cluster A4: Memory, Identity & Ghost Distortion (5 Modules)

19. **`gits-shell-fracture` — 3D Prosthetic Glass / Ceramic Crack**
    - **Spectacle:** At a moment of physical trauma or existential shock, a razor-fine translucent crack spiderwebs across the screen's corner glass with light-refracting edges and subtle chromatic aberration—staying lightly etched until a later "repair" block clears it.
    - **Mobile GUI:** Corner origin (`Top-Left` / `Bottom-Right` / `Center-Edge`), severity (`Hairline` / `Shattered`), persist until cleared toggle.
    - **Layer:** `overlay-vfx` (SVG/WebGL refraction overlay).

20. **`gits-eye-dilation` — Focus Depth & Vignette Tunnel**
    - **Spectacle:** Smoothly contracts peripheral blur and dark optical vignetting around a single pivotal sentence while muting ambient room noise into a hollow low-pass underwater hum—mirroring cyberbrain hyper-focus or sensory dissociation.
    - **Mobile GUI:** Target prose line, intensity (`Subtle` / `Tunnel Vision`), audio low-pass muffle toggle.
    - **Layer:** `backdrop` + `audio-haptic`.

21. **`gits-mirror-echo` — Dual-Identity Text Reflection**
    - **Spectacle:** Renders a short philosophical or inner-monologue line with a faint inverted reflection beneath it—except the reflection subtly spells out the unspoken truth (e.g., *"I am still human"* reflects as *"I am still running"*).
    - **Mobile GUI:** Top sentence, reflected sentence, shimmer animation toggle.
    - **Layer:** `inline` (DOM + CSS).

22. **`gits-reboot-sequence` — Cold Boot & Optical Calibration**
    - **Spectacle:** Briefly blacks out the viewport with a sharp power-down whine, then runs a crisp 1.5-second prosthetic eye reboot (`OPTICAL BUS OK · MEMORY CHECK 99.4% · GHOST LINE STABLE`) as the scene fades back into sharp focus.
    - **Mobile GUI:** 3–4 short boot lines, reboot duration (`Fast 1s` / `Dramatic 2.5s`), glitch-on-wake toggle.
    - **Layer:** `overlay-vfx` + `audio-haptic`.

23. **`gits-memory-fragment` — Floating Parallax Polaroid / Data-Shard**
    - **Spectacle:** Suspends a translucent, beveled 3D glass data-card showing a fragmented memory image or cryptic clue; it subtly tilts in 3D space with scroll or phone gyroscope, catching cool specular reflections like a hologram held in your hand.
    - **Mobile GUI:** Image asset, memory date/tag, tilt reactivity (`On` / `Off`), glass tint.
    - **Layer:** `inline` (Three.js / CSS 3D tilt).

### Cluster A5: Hardware, Ballistics & Sterile Atmosphere (5 Modules)

24. **`gits-holo-artifact` — 3D Inspectable Evidence Prop**
    - **Spectacle:** Tosses or levitates a detailed 3D object (a cyberbrain plug, micro-drive, neural chip, or encrypted keycard) into open screen space with slow studio lighting and subtle floating callout specs—the reader can spin it with a finger before scrolling on.
    - **Mobile GUI:** `.glb` 3D model picker, material style (`Hologram` / `Brushed Titanium` / `Matte Polymer`), caption label, interactive spin toggle.
    - **Layer:** `overlay-vfx` / `inline` (Three.js).

25. **`gits-megacity-rain` — High-Altitude Neon Rain & Glass Beads**
    - **Spectacle:** Adds subtle, GPU-lightweight rain streaks and slowly sliding backlit bokeh condensation drops along the dark viewport margins, shifting the scene into a high-rise Tokyo/New Port night without obstructing text contrast.
    - **Mobile GUI:** Intensity (`Drizzle` / `Downpour`), city glow accent (`Cyan` / `Sodium Amber` / `Magenta`), ambient rain audio toggle.
    - **Layer:** `backdrop` (GLSL shader / Canvas2D) + `audio-haptic`.

26. **`gits-emp-surge` — Electromagnetic Pulse Flicker & Drop**
    - **Spectacle:** A sudden horizontal static tear rips across the screen, briefly inverting colors into negative phosphor, killing active ambient audio with a sharp capacitor whine, and leaving dead silence for the next beat.
    - **Mobile GUI:** Pulse strength (`Flicker` / `Full Blackout`), kill ambient audio toggle, recovery time.
    - **Layer:** `overlay-vfx` + `audio-haptic`.

27. **`gits-mech-telemetry` — Spider-Tank / Drone Status Feed**
    - **Spectacle:** Displays a sleek miniature wire-frame status widget for an allied drone or AI companion—showing playful or urgent micro-chatter alongside live posture/battery indicators as it scouts ahead in the story.
    - **Mobile GUI:** Unit name, status icon (`Patrol` / `Stealth` / `Alert` / `Damaged`), dialogue line, chirp SFX.
    - **Layer:** `inline` (DOM + SVG).

28. **`gits-case-dossier` — Section-9 Swipeable Investigation File**
    - **Spectacle:** Presents a sleek, layered digital case file with swipeable tabs (`PROFILE` / `INCIDENT` / `AUTOPSY`) styled like an official futuristic intelligence terminal—allowing reluctant readers to flip through lore in bite-sized visual cards instead of exposition walls.
    - **Mobile GUI:** Case number, 2–4 tabs (each with title, optional portrait, and 3–4 short bullet fields).
    - **Layer:** `inline` (Interactive DOM card).

---

## 6. Genre Gimmick Catalog B — *Black Lagoon* Style (28 Modules)
**Aesthetic Pillars:** Sun-bleached tropical grit, humid barroom smoke, heavy brass and steel, visceral gunplay, cynical dark humor, analog paperwork, gambling & vices, roaring boat engines, neon-lit sleaze, tactile physical spectacle.

### Cluster B1: Vice, Gambling & Street Deals (6 Modules)

1. **`bl-dice-3d` — 3D Physics Dice Throw** *(Flagship Spectacle)*
   - **Spectacle:** Launches weighted 3D dice (worn ivory, casino red acrylic, scratched brass, or obsidian) onto the empty screen space over the prose using real rigid-body physics—bouncing off the viewport walls with realistic clatter SFX, casting soft shadows on the page, and settling cleanly with the exact scripted story numbers face-up. Phone readers can optionally tap or shake to toss.
   - **Mobile GUI:** Dice set (`1d6` / `2d6` / `3d6` / `1d20`), material (`Ivory` / `Casino Red` / `Brass` / `Obsidian`), outcome mode (`Scripted` + exact numbers or `Random`), throw trigger (`Auto` / `Tap or Shake`).
   - **Layer:** `overlay-vfx` (Three.js + `cannon-es` pre-simulated physics) + `audio-haptic`.

2. **`bl-coin-flip-3d` — 3D Spinning Coin Toss**
   - **Spectacle:** Flicks a heavy metallic 3D coin (tarnished silver dollar, gold doubloon, or bullet-dented token) high into the screen center with a crisp metallic *ping*, spinning in dramatic slow-mo before slapping flat onto the screen edge to reveal heads or tails.
   - **Mobile GUI:** Coin skin (`Silver Dollar` / `Gold` / `Rusted`), result (`Heads` / `Tails` / `Random`), catch-slap SFX toggle.
   - **Layer:** `overlay-vfx` (Three.js + physics) + `audio-haptic`.

3. **`bl-card-deal-3d` — Sliding Playing Cards / Poker Reveal**
   - **Spectacle:** Snaps 1 to 5 worn, dog-eared playing cards swiftly across the empty screen space with crisp paper-slide friction—landing face-down before flipping one by one on tap to reveal a dead-man's hand, ace in the hole, or marked card.
   - **Mobile GUI:** Card list (e.g., `A♠, A♣, 8♠, 8♣`), deck wear (`Fresh` / `Bar-Stained`), reveal mode (`All at once` / `Tap to flip`).
   - **Layer:** `overlay-vfx` (Three.js / CSS 3D cards) + `audio-haptic`.

4. **`bl-roulette-cylinder` — 3D Revolver Cylinder Spin**
   - **Spectacle:** Drops a photorealistic metallic 3D revolver cylinder into the open margin; the reader watches (or swipes) it spin with heavy ratchet clicks, slowing agonizingly click… click… click… onto either a hollow metallic *clack* or a thunderous chamber flash.
   - **Mobile GUI:** Rounds loaded (`1`–`6`), scripted outcome (`Empty Click` / `Live Fire`), spin interaction (`Auto` / `Swipe to Spin`).
   - **Layer:** `overlay-vfx` (Three.js) + `audio-haptic`.

5. **`bl-lighter-flick` — Brass Zippo Spark & Flame Glow**
   - **Spectacle:** Triggers the iconic metallic *clink-shhhk* of a scratched brass lighter snapping open in the corner; a warm, reactive orange flame illuminates the dark text from below, flickering gently with phone tilt until a later block snaps it shut.
   - **Mobile GUI:** Action (`Ignite` / `Snap Shut`), lighter engraving text (optional), ambient warmth glow level.
   - **Layer:** `overlay-vfx` (Canvas/Shader flame) + `audio-haptic`.

6. **`bl-cash-ledger` — Dirty Money Counter & Payout Split**
   - **Spectacle:** Stamps a grimy underworld deal breakdown right inline (`JOB: CARGO RUN · CUT: 40% · AMMO DEDUCTION: -$800 · NET: $14,200`) with a rapid mechanical tally roll and heavy rubber-stamp thud (`PAID` / `OWED` / `DOUBLE-CROSSED`).
   - **Mobile GUI:** 2–5 line items, currency symbol, final stamp text & ink color (`Red` / `Green` / `Black`).
   - **Layer:** `inline` (DOM + kinetic stamp).

### Cluster B2: Gunplay, Explosives & Physical Impact (6 Modules)

7. **`bl-shell-casings-3d` — Tinkling 3D Brass Shell Casings**
   - **Spectacle:** Ejects 1 to 12 spinning 3D brass casings (`9mm`, `.45 ACP`, or `12ga red hulls`) from the screen edge across the empty margins—bouncing and rolling to a stop with crisp metallic clinks on concrete or wood floor SFX.
   - **Mobile GUI:** Caliber (`9mm` / `.45 Brass` / `Shotgun Hull`), count slider (`1`–`12`), eject direction (`Left` / `Right`), surface sound (`Concrete` / `Wood Deck` / `Steel`).
   - **Layer:** `overlay-vfx` (Three.js + `cannon-es`) + `audio-haptic`.

8. **`bl-bullet-puncture` — Screen-Punch Bullet Holes**
   - **Spectacle:** Synced with a sharp muzzle crack and haptic jolt, realistic bullet holes punch clean through the viewport margins (with tiny radial cracks or scorched paper tears), letting light bleed through the holes for the rest of the firefight scene.
   - **Mobile GUI:** Shot count (`1`–`5`), burst cadence (`Single` / `Double-Tap` / `Full-Auto Spray`), surface style (`Glass` / `Steel` / `Paper`).
   - **Layer:** `overlay-vfx` (Canvas/WebGL decals) + `audio-haptic`.

9. **`bl-muzzle-strobe` — Rapid Gunfire Lighting Flash**
   - **Spectacle:** During a pitch-black ambush or bar shootout, brief synchronized amber-white muzzle flashes rhythmically illuminate the dark page margins, casting stark high-contrast silhouettes before plunging back into shadow.
   - **Mobile GUI:** Burst pattern (`Single Shot` / `3-Round Burst` / `Crossfire`), audio preset (`Pistol` / `SMG` / `Heavy MG`), reduced-motion auto-cap (always enforced).
   - **Layer:** `backdrop` + `audio-haptic`.

10. **`bl-concussion-wave` — Explosion Shockwave & Ear-Ring**
    - **Spectacle:** A heavy blast jolts the typography with a damped physical recoil and brief radial shockwave distortion, immediately ducking all background sound into a stark, realistic post-blast tinnitus ring that slowly fades back into roaring chaos.
    - **Mobile GUI:** Blast size (`Grenade` / `RPG` / `Fuel Tank`), ear-ring duration (`None` / `Short 2s` / `Long 4s`), debris embers toggle.
    - **Layer:** `overlay-vfx` + `audio-haptic` (Web Audio filter sweep).

11. **`bl-blade-slash` — Kinetic Cut & Text Split**
    - **Spectacle:** A razor-fast metallic gleam slices diagonally across a dramatic line of dialogue or scene title—literally cleaving the text along the cut line so the two halves slide slightly apart by a few pixels with a sharp steel whisper.
    - **Mobile GUI:** Target line, slash angle (`Diagonal Left` / `Diagonal Right` / `Horizontal`), metallic gleam color.
    - **Layer:** `inline` (SVG clip-path kinetic split) + `audio-haptic`.

12. **`bl-ammo-counter` — Brutalist Mag & Countdown Strip**
    - **Spectacle:** Displays a stark row of metallic bullet silhouettes in the corner during a standoff (`15 / 15` → dropping one by one on each beat until the final empty red click), cranking up dread without writing a single RPG mechanic.
    - **Mobile GUI:** Action (`Show` / `Fire X Rounds` / `Reload` / `Hide`), magazine capacity (`6` / `8` / `15` / `30`).
    - **Layer:** `overlay-dom` + `audio-haptic`.

### Cluster B3: Analog Media, Paperwork & Underworld Intel (6 Modules)

13. **`bl-bounty-dossier` — Stained Manila Folder & Polaroid Clip**
    - **Spectacle:** Slides an authentic, slightly coffee-ringed manila dossier into the reading column with a paper-clipped mugshot/Polaroid, typewritten target alias, bounty figure, and bold red stamp (`DEAD OR ALIVE` / `CANCELLED` / `HIGH RISK`).
    - **Mobile GUI:** Portrait image, target name, 3–4 short intel fields, bounty amount, stamp text.
    - **Layer:** `inline` (High-craft textured DOM card).

14. **`bl-polaroid-drop` — 3D Tossed Evidence Photograph**
    - **Spectacle:** Tosses a glossy physical Polaroid onto the screen with natural rotation and subtle drop shadow; tapping it flips the photo over in 3D to reveal a rushed handwritten note scrawled on the back in faded ballpoint pen.
    - **Mobile GUI:** Front photo asset, handwritten front caption, hidden back-side note text, toss angle.
    - **Layer:** `inline` / `overlay-vfx` (CSS 3D / Three.js) + paper slap SFX.

15. **`bl-radio-squelch` — VHF Marine / Police Scanner Chatter**
    - **Spectacle:** Breaks into the page as a crackling, band-pass-filtered radio transmission (`CH-16 // LAGOON ACTUAL: "Coast Guard cutter bearing 240..."`) with authentic squelch tails, static burst jitter, and amber LCD frequency typography.
    - **Mobile GUI:** Channel/callsign, transmission text, static level (`Clean` / `Heavy Storm`), optional voice clip.
    - **Layer:** `inline` (DOM + Web Audio squelch synth).

16. **`bl-burn-notice` — Match-Lit Paper Ash Burn**
    - **Spectacle:** Displays a secret contract, shipping manifest, or note; once the reader taps "Burn it" (or scrolls past the beat), a realistic glowing ember edge eats diagonally across the paper in real-time, curling it into rising ash sparks until nothing remains.
    - **Mobile GUI:** Document title, body text, trigger (`Auto on beat` / `Tap to burn`), burn speed.
    - **Layer:** `inline` (GLSL noise-dissolve shader / Canvas2D) + crackle SFX.

17. **`bl-shipping-manifest` — Contraband Bill of Lading**
    - **Spectacle:** Renders a crisp, dot-matrix or carbon-copy maritime manifest (`VESSEL: BLACK LAGOON · PORT: ROANAPUR · CARGO: "MACHINE PARTS"`) with a subtle interactive "Peel / Inspect" tab that exposes the real illicit cargo scribbled in pencil underneath.
    - **Mobile GUI:** Vessel/origin/destination, cover cargo text, hidden real cargo text, weathered paper style.
    - **Layer:** `inline` (Interactive DOM card).

18. **`bl-burner-sms` — Cracked-Screen Flip Phone / Burner Text**
    - **Spectacle:** Pops up a gritty, low-res monochrome or amber-backlit burner phone screen (complete with hairline glass scratch and low-battery icon) receiving terse, ominous underworld texts with harsh vibration buzzes.
    - **Mobile GUI:** Caller ID (`UNKNOWN` / `HOTEL MOSCOW` / `DUTCH`), 1–4 terse messages, phone era (`90s Flip` / `Cracked Burner`), vibrate toggle.
    - **Layer:** `inline` (Diegetic DOM) + `audio-haptic`.

### Cluster B4: Roanapur Atmosphere — Smoke, Rain, Neon & Sea (5 Modules)

19. **`bl-cigarette-smoke` — Rising Barroom Smoke Tendrils**
    - **Spectacle:** Releases soft, realistic curling wisps of cigarette or cigar smoke rising lazily from the bottom screen corner through empty space, gently drifting away when the reader scrolls past—giving quiet barroom monologues unforgettable mood.
    - **Mobile GUI:** Density (`Single Wisp` / `Smoky Bar`), drift side (`Left` / `Right`), warm ash glow toggle.
    - **Layer:** `overlay-vfx` (Lightweight GLSL fluid/noise shader).

20. **`bl-neon-buzz` — Flickering Dive-Bar Neon Sign**
    - **Spectacle:** Renders a glowing, slightly faulty neon chapter/location header (e.g., `YELLOW FLAG BAR` or `ROANAPUR DOCKS`) where one letter sputters and hums with authentic 60Hz fluorescent buzz, casting a soft colored light bleed onto surrounding dark text.
    - **Mobile GUI:** Sign text, neon color (`Hot Pink` / `Warm Amber` / `Cheap Cyan` / `Blood Red`), flicker broken-letter index, buzz SFX toggle.
    - **Layer:** `inline` (CSS/SVG neon glow + Web Audio hum).

21. **`bl-monsoon-glass` — Tropical Downpour & Heat Lightning**
    - **Spectacle:** Sweeps heavy diagonal tropical rain across the screen edges paired with occasional distant, slow-rolling heat-lightning flashes and muffled harbor thunder—perfect for tense dockside standoffs or night chases.
    - **Mobile GUI:** Storm intensity (`Muggy Drizzle` / `Typhoon`), lightning frequency (`Off` / `Rare` / `Storm`), thunder audio toggle.
    - **Layer:** `backdrop` (Canvas/Shader) + `audio-haptic`.

22. **`bl-boat-swell` — Open-Water Horizon Tilt & Spray**
    - **Spectacle:** Applies a subtle, gentle nautical swell (1–2 degree damped sway—strictly off under reduced motion) to media frames and horizon dividers, paired with rhythmic hull-slap and outboard diesel rumble for torpedo-boat chase sequences.
    - **Mobile GUI:** Sea state (`Harbor Idle` / `High-Speed Chase`), engine bed (`Idle Diesel` / `Full Throttle` / `Silent`), sea-spray mist toggle.
    - **Layer:** `backdrop` + `audio-haptic`.

23. **`bl-whiskey-stain` — Atmospheric Page Texture & Ring Stains**
    - **Spectacle:** Subtly shifts the reader's paper/dark background texture for a scene—adding faint bar-table wood grain, dried whiskey glass rings, or salt-stained parchment edges so the setting physically bleeds onto the page itself.
    - **Mobile GUI:** Surface preset (`Clean` / `Dive Bar Wood` / `Sun-Bleached Dock` / `Blood-Flecked Concrete`), opacity slider.
    - **Layer:** `backdrop` (Tiled CSS/Canvas texture).

### Cluster B5: Grit, Tension & Raw Character Kinetics (5 Modules)

24. **`bl-shout-impact` — Kinetic Slam & Heavy Typography**
    - **Spectacle:** When a character slams a table, screams over gunfire, or delivers a brutal punchline, that single line slams onto the screen with bold condensed impact typography, a tiny 120ms screen thump, and hairline dust/chalk particles bursting off the letters.
    - **Mobile GUI:** Shout text, impact weight (`Table Slam` / `Gunshot Yell` / `Deadpan Drop`), thump SFX & haptic toggle.
    - **Layer:** `inline` (Kinetic DOM + micro-particles) + `audio-haptic`.

25. **`bl-title-card` — Grindhouse / Pulp Act Card**
    - **Spectacle:** Interrupts the scroll with a punchy, widescreen Tarantino/anime-eyecatch act card (`ACT II: NO HONOR IN ROANAPUR`) featuring bold distressed stencil typography, brief film-grain pop, and a crisp guitar chord or brass sting.
    - **Mobile GUI:** Eyecatch tag (`ACT II` / `03:14 AM`), bold headline, color scheme (`Crimson/Black` / `Mustard/Ink` / `Bleached Bone`), sting SFX.
    - **Layer:** `inline` (Full-bleed CSS/SVG) + `audio-haptic`.

26. **`bl-clock-tick` — Standoff Countdown & Fuse**
    - **Spectacle:** Drops an analog ticking stopwatch, digital C4 timer, or sputtering physical fuse line onto the top edge of the viewport—counting down in sync with the reader's taps or real seconds to turn a 6-paragraph escape into pure adrenaline.
    - **Mobile GUI:** Visual style (`Analog Watch` / `C4 LED` / `Burning Fuse`), pacing mode (`Advances per Tap` / `Real-Time Seconds`), starting value, alarm/cut ending.
    - **Layer:** `overlay-dom` / `overlay-vfx` + `audio-haptic`.

27. **`bl-blood-ink` — Stark Noir Contrast & Ink Splatter**
    - **Spectacle:** For brutal turning points, briefly strips the entire screen palette down to stark comic-noir black, white, and a single sharp crimson accent—accented by an artistic ink-brush splash tucked cleanly into the page margin (stylized pulp art, never cheap gore).
    - **Mobile GUI:** Action (`Engage Noir Palette` / `Restore Normal`), accent color (`Crimson` / `Gold`), margin ink-brush style.
    - **Layer:** `backdrop` + theme override.

28. **`bl-jukebox-needle` — Vinyl / Cassette Needle Drop**
    - **Spectacle:** Drops a tactile little diegetic cassette deck or jukebox track banner (`NOW PLAYING: "RED HARBOR BLUES"`) with an authentic vinyl crackle or mechanical tape-deck *clunk* before kicking in the scene's needle-drop soundtrack—and a jarring record-scratch stop option for comedic or violent interruptions.
    - **Mobile GUI:** Action (`Drop Track` / `Abrupt Stop`), track display title, audio file, deck style (`Dusty Vinyl` / `Car Cassette` / `Dive Jukebox`).
    - **Layer:** `inline` (Diegetic mini-player) + `audio-haptic`.

---

## 7. Genre Gimmick Catalog C — *Psychological Thriller* Style (28 Modules)
**Aesthetic Pillars:** Unreliable narration, subtle gaslighting, creeping domestic dread, paranoia & unseen observation, claustrophobia, fractured memory, clinical unease, tactile personal artifacts, restraint over cheap jump-scares.

### Cluster C1: Unreliable Narrator & Text Gaslighting (6 Modules)

1. **`pt-gaslight-edit` — Retroactive Scroll-Back Mutation**
   - **Spectacle:** Displays an innocent detail while reading forward (e.g., *"The hallway door was locked from the inside"*). The moment the reader scrolls past it and later scrolls *back up* to double-check, the phrase has silently mutated without animation (*"The hallway door was never locked"*), weaponizing the reader's own memory.
   - **Mobile GUI:** Initial text, mutated text, trigger (`On Scroll-Back` / `After 6 Seconds`), subtle highlight flash toggle (`Off` recommended for maximum paranoia).
   - **Layer:** `inline` (DOM IntersectionObserver).

2. **`pt-unspoken-margin` — Intrusive Margin Scribbles**
   - **Spectacle:** Faint, frantic handwritten pencil or red-pen marginalia creeps quietly into the empty screen gutter beside calm, polite prose—contradicting the narrator's composed voice (*"she knows"*, *"check the closet again"*) before fading slightly when focused.
   - **Mobile GUI:** Main prose line, margin scribble text, handwriting style (`Nervous Pencil` / `Scratchy Pen`), side (`Left` / `Right`).
   - **Layer:** `inline` / `overlay-dom` (SVG handwriting path).

3. **`pt-hesitation-backspace` — Live Self-Censoring Confession**
   - **Spectacle:** Types out a raw, damning confession right in the reading column, pauses for a breathless beat, rapidly backspaces the dangerous words, and smoothly replaces them with a sanitized excuse—letting the reader catch the narrator lying in real time.
   - **Mobile GUI:** Raw truth text, pause milliseconds, sanitized replacement text, typing cadence (`Steady` / `Trembling`).
   - **Layer:** `inline` (DOM kinetic typography).

4. **`pt-blackout-smudge` — Repressed Memory Ink Bleed**
   - **Spectacle:** A specific name, date, or repressed word inside a paragraph slowly blooms with dark, wet charcoal ink bleed as the reader looks at it—smudging itself illegible just a beat after being read, accompanied by a soft dry paper scratch.
   - **Mobile GUI:** Full paragraph, target span to smudge, bleed speed (`Slow` / `Sudden`), allow tap-to-glimpse toggle.
   - **Layer:** `inline` (Canvas/CSS ink filter) + `audio-haptic`.

5. **`pt-split-voice` — Dissociative Depth Echo**
   - **Spectacle:** Layers a faint second inner monologue slightly offset in z-depth behind the primary prose; as the reader scrolls, subtle parallax drift causes the two voices to slip in and out of alignment, evoking cognitive dissonance or identity fracture.
   - **Mobile GUI:** Primary line, shadow inner-voice line, parallax drift intensity, whisper tint.
   - **Layer:** `inline` (CSS/DOM layered typography).

6. **`pt-loop-dejavu` — Subtle Déjà Vu Beat Skip**
   - **Spectacle:** Replays a short, rhythmic beat from earlier in the chapter almost word-for-word—except one crucial noun is quietly inverted and a soft, hollow piano note or faint tape-splice click marks the hairline crack in the narrator's timeline.
   - **Mobile GUI:** Repeated passage text, altered word highlight (`Subtle Drift` / `Silent`), splice sound (`None` / `Tape Click` / `Hollow Note`).
   - **Layer:** `inline` + `audio-haptic`.

### Cluster C2: Paranoia, Surveillance & Being Watched (6 Modules)

7. **`pt-peephole-lens` — Fisheye Apartment Peephole**
   - **Spectacle:** Opens a dark, brass-rimmed circular fisheye lens inline showing a dimly lit hallway image or silhouette; gently tilting the phone (or dragging a finger) shifts the perspective slightly inside the distorted glass, as if pressing your eye closer to the door.
   - **Mobile GUI:** Hallway image asset, lens distortion level, dim hall flicker toggle, subtle breath/creak SFX.
   - **Layer:** `inline` (WebGL fisheye shader / CSS fallback).

8. **`pt-peripheral-shadow` — Edge-of-Vision Passing Silhouette**
   - **Spectacle:** Exactly once per scene, an ultra-soft, barely-there dark human silhouette glides silently across the far outer screen margin while the reader is absorbed in the middle of a paragraph—vanishing instantly if they look toward it or tap, leaving genuine *"did I just see that?"* dread.
   - **Mobile GUI:** Margin side (`Left` / `Right`), pass speed (`Fleeting 0.6s` / `Lingering 1.4s`), opacity cap (`Subtle` / `Clear`).
   - **Layer:** `overlay-vfx` (Canvas/Shader silhouette).

9. **`pt-window-blinds` — Venetian Blind Streetlight Slats**
   - **Spectacle:** Casts soft, angled dark shadow bars of closed Venetian blinds across the page backdrop; slowly, the streetlight outside shifts—as if headlights swept past or a figure paused right outside the glass, then walked away.
   - **Mobile GUI:** Lighting tint (`Cold Streetlight` / `Passing Headlights` / `Moonlight`), movement event (`Static` / `Car Pass` / `Figure Pause`).
   - **Layer:** `backdrop` (Lightweight CSS/Canvas lighting).

10. **`pt-room-monitor` — Audio-Triggered Baby / Room Monitor**
    - **Spectacle:** Embeds a cold, grainy monochrome monitor strip inline with a tiny row of green-to-red LED volume bars—sitting dead quiet in soft white noise until a muffled floorboard creak or whispered phrase spikes the amber LEDs right on beat.
    - **Mobile GUI:** Room label (`NURSERY` / `UPSTAIRS HALL`), audio clip or synth creak preset, transcript whisper, static intensity.
    - **Layer:** `inline` (DOM + Web Audio AnalyserNode).

11. **`pt-mirror-lag` — Out-of-Sync Reflection Frame**
    - **Spectacle:** Displays a moody portrait or dark bathroom-mirror illustration inline; half a second after the reader scrolls past or taps, the reflection subtly shifts its gaze or blinks independently from the "real" frame—creating instant uncanny valley chill.
    - **Mobile GUI:** Base image asset, shifted/altered image asset, lag delay (`0.5s` / `1.2s`), trigger (`On Pause` / `On Tap`).
    - **Layer:** `inline` (Crossfade/Shader frame).

12. **`pt-footsteps-binaural` — Spatial Stereo Footsteps & Knocks**
    - **Spectacle:** Uses true Web Audio stereo panning to walk slow, muffled footsteps from the reader's left ear to right ear across the room—or deliver three unmistakable, realistic wooden knocks that feel like they came from right behind the reader's phone.
    - **Mobile GUI:** Sound preset (`Hallway Footsteps` / `3 Soft Knocks` / `Door Handle Jiggle` / `Whisper Behind`), pan path (`Left → Right` / `Right → Left` / `Behind`), volume curve.
    - **Layer:** `audio-haptic` (Web Audio StereoPannerNode + optional subtle haptic knock).

### Cluster C3: Tactile Evidence, Journals & Physical Artifacts (6 Modules)

13. **`pt-pill-bottle-3d` — 3D Prescription Bottle Inspection**
    - **Spectacle:** Drops or floats a translucent amber 3D prescription bottle into the open screen space with tiny white pills audibly rattling inside; the reader can gently rotate it with a finger to read the faded pharmacy label—and spot the scratched-out dosage or wrong patient name on the back.
    - **Mobile GUI:** Medication name, patient name, dosage warning line, pill count (`Full` / `Half` / `Empty`), rattle SFX on tilt/tap toggle.
    - **Layer:** `overlay-vfx` / `inline` (Three.js translucent amber PBR + procedural label texture) + `audio-haptic`.

14. **`pt-key-drop-3d` — 3D Heavy Brass / Apartment Key Toss**
    - **Spectacle:** Tosses a cold, tarnished 3D key (vintage skeleton key, hotel room fob, or spare house key) across the empty viewport with realistic rigid-body bounces, crisp metallic ring on hardwood/tile, and a soft cast shadow beside the prose.
    - **Mobile GUI:** Key style (`Spare House Key` / `Motel Tag Key` / `Old Skeleton Key`), tag text (e.g., `ROOM 408`), surface SFX (`Wood` / `Tile` / `Carpet`).
    - **Layer:** `overlay-vfx` (Three.js + `cannon-es`) + `audio-haptic`.

15. **`pt-torn-journal` — Reassemble Ripped Diary Page**
    - **Spectacle:** Shows a jaggedly torn notebook page with half a frantic entry missing; sliding or tapping the stray torn scrap nestled in the lower margin pulls it smoothly into alignment along the paper fibers to complete the chilling sentence.
    - **Mobile GUI:** Left half text, missing right half text, paper style (`Lined Spiral` / `Yellow Legal` / `Leather Diary`), paper-rustle SFX.
    - **Layer:** `inline` (Interactive SVG-masked DOM card).

16. **`pt-scratched-photo` — Defaced Memory Photograph**
    - **Spectacle:** Displays an intimate vintage or polaroid photograph where a person's face has been violently scratched out with frantic ballpoint pen strokes; pressing and holding a finger gently fades the violent ink away for a brief moment to reveal who was actually standing there.
    - **Mobile GUI:** Original photo asset, scratch intensity (`Light` / `Frantic`), handwritten date caption, hold-to-glimpse toggle.
    - **Layer:** `inline` (Layered Canvas/DOM).

17. **`pt-microcassette` — Therapy / Evidence Dictation Deck**
    - **Spectacle:** Inserts a tactile, brushed-metal 90s microcassette recorder (`SESSION 14 · 01:42`) with smoothly spinning dual reels, warm magnetic tape hiss, mechanical button clicks, and synchronized line-by-line transcript—with an optional eerie mid-sentence rewind/replay glitch.
    - **Mobile GUI:** Tape label, audio clip (or silent timed transcript), transcript lines, mid-tape rewind glitch toggle.
    - **Layer:** `inline` (Interactive DOM/SVG + Web Audio).

18. **`pt-door-chain` — Tactile Brass Security Chain / Deadbolt**
    - **Spectacle:** Renders a crisp minimalist brass slide-bolt or door chain inline at a moment of domestic intrusion; the reader physically slides it shut with their thumb (producing a heavy metallic *clack* and haptic lock)—only for the next beat to rattle it violently from the outside.
    - **Mobile GUI:** Hardware type (`Brass Chain` / `Heavy Deadbolt`), interaction (`Slide to Lock` / `Auto-Rattle`), rattle intensity.
    - **Layer:** `inline` (Interactive touch control) + `audio-haptic`.

### Cluster C4: Claustrophobia, Light & Sensory Dread (5 Modules)

19. **`pt-flashlight-cone` — Pitch-Black Spotlight Reveal**
    - **Spectacle:** Plunges a short, tense passage into near-total darkness where sweeping a thumb or cursor moves a realistic soft-edged flashlight cone across the hidden prose, revealing words only where the dying beam falls (with an instant "Lights On" accessibility tap).
    - **Mobile GUI:** Hidden paragraph lines, beam width (`Narrow` / `Wide`), battery flicker toggle, ambient dark hum.
    - **Layer:** `inline` / `overlay-vfx` (CSS radial mask / Canvas2D).

20. **`pt-closing-walls` — Gradual Margin Contraction**
    - **Spectacle:** Imperceptibly narrows the reading column margins by a few pixels per beat while deepening cold peripheral vignetting—physically squeezing the text inward as panic or claustrophobia mounts, then abruptly exhaling back to full width when the character escapes.
    - **Mobile GUI:** Action (`Tighten Step` / `Hold Tight` / `Release Breath`), squeeze level (`Subtle` / `Suffocating`), low room-pressure drone toggle.
    - **Layer:** `backdrop` + reading-column CSS transition.

21. **`pt-dying-bulb` — Flickering Hallway Tungsten / Fluorescent**
    - **Spectacle:** Casts a sickly warm or cold overhead light cone from the top edge of the viewport that hums and sputters erratically—and during the brief dark micro-dips, a faint hidden sentence or stark contrast shadow flickers into view before snapping back to normal.
    - **Mobile GUI:** Bulb type (`Cold Fluorescent` / `Dim Hallway Tungsten`), hidden dark-frame line (optional), buzz SFX toggle.
    - **Layer:** `backdrop` / `overlay-vfx` (strictly capped flicker rate for photosensitivity safety).

22. **`pt-heartbeat-thump` — Muffled Pulse & Subtle Haptic Rhythm**
    - **Spectacle:** Underscores a hiding-in-the-closet or confrontation beat with a deep, muffled chest heartbeat synced to ultra-gentle mobile haptics and a barely perceptible radial vignette pulse that accelerates from calm `68 BPM` to panicked `130 BPM`.
    - **Mobile GUI:** Action (`Start` / `Accelerate` / `Stop`), BPM slider (`55`–`145`), haptic pulse toggle, vignette breathe toggle.
    - **Layer:** `audio-haptic` + subtle `backdrop` pulse.

23. **`pt-frost-wipe` — Condensation / Breath-Fogged Glass**
    - **Spectacle:** Veils a chilling clue, mirror message, or blurred silhouette behind realistic cold window condensation; dragging a finger across the glass wipes away a smooth, damp streak with soft glass squeak to expose what was written in the fog.
    - **Mobile GUI:** Underlying message or image, frost density (`Light Steam` / `Heavy Winter`), wipe-complete threshold.
    - **Layer:** `inline` (Interactive 2D Canvas erase mask).

### Cluster C5: Fractured Time, Therapy & Clinical Unease (5 Modules)

24. **`pt-clinical-intake` — Psychiatric Evaluation Clipboard**
    - **Spectacle:** Presents a stark, sterile institutional intake form (`PATIENT OBSERVATION · ORIENTATION: PARTIAL`) with tidy checkbox columns, flat clinical prose, and one unsettling, rushed handwritten doctor's note crammed into the bottom margin.
    - **Mobile GUI:** Form title, patient ID, 3–5 checked symptom rows, clinical summary, handwritten bottom note.
    - **Layer:** `inline` (Crisp institutional DOM card).

25. **`pt-clock-slip` — Impossible Bedside Digital Clock**
    - **Spectacle:** Pins a glowing dark-red LED alarm clock cleanly in the top corner during a sleepless night scene (`03:14`), silently jumping *backward* to `03:11` or snapping forward to `05:47` between beats without drawing attention to itself—letting the reader notice lost time organically.
    - **Mobile GUI:** Action (`Show` / `Jump Time` / `Hide`), displayed time string, LED color (`Hospital Red` / `Sickly Green`), silent or soft tick toggle.
    - **Layer:** `overlay-dom`.

26. **`pt-inkblot-morph` — Breathing Rorschach Canvas**
    - **Spectacle:** Floats a razor-sharp, symmetrical monochrome inkblot softly in the open screen space behind a therapy or introspection beat—imperceptibly morphing its organic edges over 10 seconds so the reader's brain keeps projecting faces, hands, or blades into the abstract ink.
    - **Mobile GUI:** Seed preset (`Symmetry I` / `Fracture` / `Hollow` / `Wings`), morph speed (`Hypnotic` / `Restless`), contrast (`Ink on Paper` / `Chalk on Obsidian`).
    - **Layer:** `backdrop` / `inline` (Lightweight GLSL metaball/noise shader).

27. **`pt-voicemail-box` — Blinking Answering Machine Message**
    - **Spectacle:** Inserts a minimalist vintage answering machine readout (`[01 NEW MESSAGE · 02:38 AM]`) with a slow blinking crimson indicator; tapping play triggers a crisp beep, distant telephone room-reverb audio (or timed captions), heavy breathing/dialogue, and an abrupt dial-tone cut.
    - **Mobile GUI:** Timestamp, caller label, audio clip (optional), transcript lines, ending cut (`Click + Dial Tone` / `Dead Air`).
    - **Layer:** `inline` (Diegetic DOM) + `audio-haptic`.

28. **`pt-silence-drop` — Absolute Dead-Air Cut**
    - **Spectacle:** At the exact beat a terrifying realization lands, instantaneously hard-cuts all active ambient room tone, rain, and music into jarring vacuum silence—surrounding a single starkly isolated sentence with generous negative space so the sudden quiet hits harder than any loud sound effect.
    - **Mobile GUI:** Stark line text, silence hold duration (`Until Next Ambient` / `3 Seconds`), subtle ear-pressure fade-back toggle.
    - **Layer:** `inline` + `audio-haptic`.

---

## 8. Anti-Bloat Discipline for Building the Catalog

Having **84 planned gimmicks** across three distinct genres (28 *Ghost in the Shell* + 28 *Black Lagoon* + 28 *Psychological Thriller*) does **not** mean building 84 gimmicks before writing Chapter 1. Follow the **Just-In-Time Module Rule**:

1. **Draft the chapter first** on your phone using core prose/dialogue and placeholder notes where you imagine a spectacle.
2. **Pick at most 2–3 signature gimmicks per chapter** so every moment lands hard instead of feeling like a cluttered slideshow.
3. **Commission Claude one isolated module at a time**, adhering strictly to the 3-part plugin contract (`schema.ts`, `card.ts`, `renderer.ts`) and reviewing it directly on your phone via `/sandbox`.
4. **Cross-pollinate freely:** Because modules are decoupled, nothing stops a *Ghost in the Shell* cyber-noir novel from activating `pt-gaslight-edit` or `bl-dice-3d` in its `novel.json` manifest—and cutting them cleanly for the next book.