# Imagination Engine — Plan (v2)

A modular engine and studio for interactive text novels that runs in the browser on mobile and desktop.

**What it covers:**
- **Stories:** branching stories you can write in English and Turkish without code.
- **Gameplay:** RPG systems, rhythm combat that locks onto the music's beat, and minigames.
- **Presentation:** kinetic typography and glyph effects that can stage a whole fight with no images.
- **Editors:** a Premiere-style sequencer and an Unreal-style material graph.

It isn't tied to one genre or look: every system is optional, and every style is a theme.

**The novel is the interface.** There is no branding, no logo, no splash screen, and no chrome you didn't ask for.

---

## 0. Decisions so far

| Topic | Decision | Why |
|---|---|---|
| Story system | **Our own story format** with three views (Manuscript, Flow, and later Script). It replaces ink | Can be built with no code, has localization built in, any module can add new block types, and schemas keep every file valid. See §3.1 |
| Logic | **Sentence-style blocks**: Actions, Conditions, Rules (When → If → Do), Routines | Readable without programming knowledge, and the same blocks work everywhere |
| Languages | **English + Turkish**, for both novels and the Studio UI, switchable even mid-game | You asked for both. Turkish needs special handling (suffixes, casing, hyphenation). See §4 |
| Music | **Many sources. Spotify and YouTube are optional extras** | Files, open music catalogs, AI-generated music, and built-in procedural music all give fully automatic beat sync. See §5 |
| Beat analysis | **Beat This!** (a 2024 beat tracker, MIT licence) in the browser through onnxruntime-web, plus **Meyda** for audio features. *Beat This! (the full model, an opt-in download) runs in the Studio, with an own DSP tracker as the fallback (ADR 0013); results are prepared on desktop and travel with the novel (ADR 0014)* | Best available accuracy, finds **downbeats** (bar starts), and avoids AGPL dependencies |
| Style | **Genre-agnostic.** Optional modules, gameplay kits, themes, and a no-code screen builder | Not locked to one style |
| Development | Runs only on this PC. Phone testing over **adb reverse**; debugging with `chrome://inspect` | Private, no certificates needed, and the phone sees a secure context |
| Hosting (later) | Static host. Recommended: **Cloudflare Pages + Cloudflare Access** (private login), Workers for small proxies | Free, fast, private. No server to maintain |
| How it's built | AI writes the code, guided by schemas, tests, and `CLAUDE.md` conventions | See §12 |
| Fight modes | **Both**: call & response and free beat, which can be mixed within one fight | You asked for both. See §6.4 |
| Publishing | The Studio stays private, but **individual novels can be published**. A built-in publish check covers music rights and credits | Spotify and YouTube are private-only, and Creative Commons terms vary by licence. See §5 and §10.1 |
| AI in the Studio | **None.** There's no AI writing assistant | Your call. AI is only used to write the engine's code |
| Reference phone | **Redmi Note 12 4G**: Snapdragon 685, Adreno 610 GPU, 6 GB RAM, 120 Hz 1080×2400 OLED, gyroscope | Every performance target is measured on it. See §11.1 |

---

## 1. Principles

**Engine**
1. **No-code first, code optional.** Everything is creatable in the Studio with forms, blocks, graphs, and timelines. Code plugins exist for power use, written by you or by AI.
2. **Progressive disclosure.** Simple by default; *Advanced* reveals formulas, raw data, and fine timing. The Studio UI uses plain language, e.g. "Yes/No" rather than "boolean".
3. **Modules all the way down.** Every system (story, rhythm, RPG, minigames, screens…) is an optional module. Each one registers its blocks, commands, data types, timeline tracks, graph nodes, and editor panels with a small kernel. Projects only show the modules they use.
4. **One mental model.** The same *Action* and *Condition* blocks work in story passages, rules, routines, sequencer tracks, item effects, minigame events, and the debug console.
5. **Data first, editors second.** Every feature first runs from plain project data, and editors are views over that data. The engine is always playable, and the data is always readable and easy to diff.
6. **Beats, not seconds.** Anything musical is authored in beats, so it fits any song's tempo automatically.
7. **Local-first.** Projects live on your device, work offline, and export as plain files.

**Design language** (this is the *default* theme; themes can change all of it)
- **Player:**
  - No chrome. Tap or click advances the text.
  - A hairline menu appears only when you summon it (tap the top edge, or press Esc).
  - The menu is a quiet typographic list: *Continue · Save · Load · Log · Settings*.
- **Typography:**
  - Fonts: serif prose (Literata or Source Serif 4), Inter for the UI, JetBrains Mono for glyph art, and Atkinson Hyperlegible as an accessibility option.
  - All of these fully cover Turkish characters.
  - Lines run 60–70 characters wide with 1.6 line height.
- **Colour:**
  - Two base themes: *Paper* (warm off-white with ink text) and *Night* (near-black with warm-grey text).
  - Each novel gets one accent colour.
  - Colour is used only for meaning.
- **Motion:** UI motion lasts 120–200 ms with ease-out. *The story can be loud. The UI never is.*
- **Studio:**
  - Neutral greyscale, 1 px hairlines, 12–13 px UI type.
  - One icon set (Lucide).
  - Node categories are small muted dots.
  - Shadows only on floating layers.
- **No branding:** the window title is the project name, and the favicon is a generated monogram.

---

## 2. Architecture

```
 STUDIO (editor app, React; English/Turkish UI)
   Manuscript · Flow · Logic · Characters · Variables · Translation · Screens · Theme
   Music & Charts · Sequencer · Material Graph · Data · Minigames · Library · Playtest/Debug
   └─ all edit one Project document ──► live Preview (embeds the Player)

 PLAYER RUNTIME (vanilla TypeScript; embeddable; exportable as a standalone build)
   Modules ─ Story · Logic · Presenter · Screens · Render/VFX · Audio · Music · Rhythm
             Kits (RPG, turn-based, explorer, social, survival…) · Minigames · plugins
   Kernel  ─ Module registry · Action/command bus · Event bus · Variables & state
             Conductor (music clock) · Loop · Input actions · Save/Load · Assets · i18n

 PLATFORM
   WebGL2 stage (own renderer, ADR 0015) · WebGPU for analysis · Web Audio · DOM · OPFS / IndexedDB · Service worker
```

### Tech stack

| Concern | Choice | Why |
|---|---|---|
| Language / build | TypeScript (strict), Vite, pnpm workspaces | Typed, fast, and safe for AI-written code |
| Player runtime | Vanilla TS | Small and fast, and it runs everywhere |
| Studio UI | React 19 + Zustand, Radix primitives, own CSS tokens | Richest editor ecosystem. Headless primitives keep the look ours |
| Manuscript editor | Block cards with plain-text fields and markup chips (ADR 0011; replaces TipTap) | Blocks stay typed data with stable IDs; Android keyboards keep the native input path |
| Graph editors | React Flow (@xyflow/react) + ELK.js auto-layout | Mature. Tap-to-connect works on touch screens |
| Code/formula fields | CodeMirror 6 | Works on mobile |
| Docking | dockview (desktop only) | NLE/IDE-style layouts (an NLE is a non-linear video editor like Premiere) |
| Rendering | **Own WebGL2 renderer** (ADR 0015): one instanced sprite draw plus one full-screen pass. three.js + TSL may return for the material graph | Two draw calls a frame and a tiny bundle on the Adreno 610 |
| GPU text | Custom instanced SDF glyphs, generated at runtime from the page's font (TinySDF-style); MSDF later if large sizes need sharper corners | Gives per-glyph shader control |
| Audio | Web Audio API + Tone.js (synths and effects) | Our own Conductor owns the clock |
| Beat analysis | **Beat This!** ONNX (onnxruntime-web, WebGPU with WASM fallback), **Meyda** (features), optional **demucs-web** (stems) | Beats and downbeats, onsets, energy, key. All MIT-compatible |
| Schemas | Zod | Schemas validate data, generate forms, drive migrations, and act as AI guardrails |
| Expressions | Own small, safe formula parser (no `eval`) | Used by conditions and formulas |
| i18n | Own Turkish morphology helper, `Intl` (PluralRules, Collator), ICU messages, **Hyphenopoly** (tr + en hyphenation) | See §4 |
| Search | MiniSearch with Turkish-aware normalization | Project-wide search |
| Storage | OPFS + IndexedDB (idb), File System Access API (desktop), zip via fflate | Local-first |
| Offline / install | vite-plugin-pwa | Installable app |
| Icons | Lucide (UI), **game-icons.net** (4000+ RPG icons, CC BY 3.0), converted to an MSDF atlas | Shaders can act on icons too |
| Tests | Vitest, Playwright (mobile emulation, plus optional real-phone runs over adb) | Keeps AI-written code honest |

### Monorepo layout

```
packages/
  core/        kernel, module API, action bus, events, state, save, input, assets
  story/       story model, interpreter, passages/blocks/choices
  logic/       actions, conditions, rules, routines, variables, formula parser
  i18n/        locales, Turkish suffix engine, plurals, hyphenation, casing
  present/     text presenters (DOM + GPU), layouts, choices UI, markup
  screens/     no-code screen/HUD runtime (layouts bound to variables)
  render/      stage, glyph renderer, actors, particles, post-FX, material runtime
  audio/       mixer, SFX, sfxr, blips, ambience
  music/       sources, analysis worker, conductor, adaptive music
  rhythm/      charts, hit judge, fight director, choreography
  kits/        rpg, turn-based, explorer, social, survival, roguelite, mystery…
  minigames/   framework + templates
  ui-kit/      design tokens + primitives shared by player and studio
apps/
  player/      standalone runtime shell (PWA)
  studio/      the editor (embeds the player for preview)
tools/
  atlas/       fonts + SVG icons → MSDF atlases
  phone/       adb helper scripts
samples/
  sampler/     bilingual demo novel that uses every feature (doubles as the regression test)
```

---

## 3. Story system

### 3.1 Why our own format

| Option | Verdict |
|---|---|
| **ink** | Powerful, but it's a programming-like text language with no built-in line IDs for translation, and it's hard to edit visually. It fails your "no coding knowledge" goal |
| **Yarn Spinner** | Has good localization, but there's no official JavaScript runtime yet. Community ports are small and incomplete |
| **Twine** | Easy, but its story formats are HTML-centric and don't fit a modular engine |
| **articy:draft / Arcweave** | External tools. The engine would depend on their export formats and pricing |
| **Own format** ✅ | Visual and textual editing over the same data. Modules can add their own block types. Every line has a stable ID for translation. Schemas keep project files valid. The interpreter is small; the real work is the editor, which we need anyway |

Importers for ink and Twine can come later if ever needed.

### 3.2 The model

```
Project
 └─ Chapter (one file each, loaded on demand)
     └─ Passage (a node in the Flow view)
         └─ Blocks (ordered; some contain other blocks)
```

**Content blocks:**
- Narration
- Dialogue (speaker + line)
- Choice set → Options, each with optional conditions, cost, and timer
- If / Else-if / Else
- Check (dice/stat roll with success and fail branches)
- Input (name entry, text answer)
- Pause
- Note (author-only)

**Flow blocks:**
- Jump → passage
- Call routine (returns afterwards)
- Random branch
- End / ending

**Action blocks** (supplied by modules):
- Set variable, Give/Take item
- Play music, Play SFX, Screen effect
- Start battle, Run minigame, Play sequence
- Show screen, Wait
- …and many more

**Rejoin:** an option without a Jump continues after the choice set. Short side branches don't need new passages.

**Variables:**
- Types: Number, Text, Yes/No, List, or One-of (an enum such as *Mood: calm / angry / afraid*).
- Scopes: **game**, **chapter**, **passage**, **temporary**, and **persistent** (survives across playthroughs, for endings unlocked or "the game remembers").
- Every variable has a description and a "find usages" view.

**Runtime state:** the current position (passage + block path) and the routine call stack, plus variables and module states. Fully serializable, so saves, rewind, and auto-testing are simple.

### 3.3 One story, three views

1. **Manuscript** (the main view: write it like a document)
   - Type `/` for the block menu.
   - Shortcuts: `Mira:` + space becomes a dialogue line; `?` starts a choice; `->` starts a jump.
   - Select text to apply effects (shake, whisper, colour) from a toolbar. No tags to type.
   - Variables appear as chips.
2. **Flow** (the map)
   - Passages are nodes, and choices and jumps are edges. Laid out automatically.
   - Drag to rewire.
   - Overlays: playthrough coverage, missing translations, and problems.
   - Tap any node to *Play from here*.
3. **Script** (later: fast typing on a keyboard)
   - A plain-text syntax that converts to and from blocks.
   - Paste text from any writing app and it becomes editable blocks.

How a passage looks in Manuscript view:

```
 ┌ The Alley ─────────────────────────────────────── EN | TR ┐
 │ ♪ Play music  Night Drive · fade 2s                        │
 │ The rain had stopped, but the alley still ≈dripped≈.       │
 │ MIRA   You hear that?                                      │
 │ ◇ Choice                                                   │
 │   ├ Draw your blade                          → Fight       │
 │   ├ Talk them down      if Charisma ≥ 6      → Parley      │
 │   └ Run                                                    │
 │       ⚄ Check  Agility vs 12                               │
 │         ✓ You vanish into the dark.          → Escaped     │
 │         ✗ Too slow.                          → Fight       │
 └────────────────────────────────────────────────────────────┘
```

### 3.4 Logic without code

- **Sentence blocks.** Actions and conditions read like sentences with blanks you fill from dropdowns:
  - *Set **Gold** to **Gold + 10***
  - *If **Mira's trust** is at least **5***
  - *Give **Iron key** ×1*

  Sentence templates are translated per language, not glued together, which matters because Turkish word order differs.
- **Rules** (event-sheet style: **When → If → Do**). They run whenever their event fires, e.g.:
  - *When HP drops below 30% → If not warned → Do: shake screen, show "You're bleeding."*
  - Possible events: variable changed, passage entered, item gained, beat or bar, timer, battle event, choice made, screen button pressed.
- **Routines:** reusable action lists with inputs, e.g. *Rest at inn (cost)*. Call them from anywhere.
- **Formulas:**
  - Optional power mode with autocomplete: `20 + con * 5 + level * 2`.
  - The visual builder and formula mode are two views of the same thing.
- **Plain-language validation.** For example:
  - *"This choice leads nowhere."*
  - *"'Gold' is never set."*
  - *"Turkish text missing in 3 lines."*

### 3.5 Choices, out of the box

- **Standard.**
- **Timed:** a countdown hairline, with a default on timeout.
- **Gated:** shown greyed out with the reason ("Requires Charisma 6").
- **Skill-check:** shows the odds ("Logic — 72%").
- **Cost:** spend gold or energy.
- **Hidden until revealed** by a stat.
- **Revisit-aware:** options change after a route has been seen.

---

## 4. English & Turkish

**Content:**
- Every text block stores both languages under one stable line ID.
- A **Translation view** shows source and target side by side.
- Each line is marked *missing* or *outdated* (the source changed after it was translated).
- Players can **switch language at any time, even mid-scene.**

**Turkish suffixes that just work.**
- Write the suffix naturally after a variable chip, and the engine re-harmonizes it for the actual word:

  | You write | Name = Kerim | Ayşe | Can | Ahmet |
  |---|---|---|---|---|
  | `{name}'e` (dative) | Kerim'e | Ayşe'ye | Can'a | Ahmet'e |
  | `{name}'de` (locative) | Kerim'de | Ayşe'de | Can'da | Ahmet'te |
  | `{name}'in` (genitive) | Kerim'in | Ayşe'nin | Can'ın | Ahmet'in |

- It covers:
  - 2-way and 4-way vowel harmony.
  - Buffer consonants (y/n).
  - Voiceless-consonant assimilation (d → t).
  - Accusative, ablative, and instrumental (ile → 'le/'yle) suffixes.
  - **Numbers by their pronunciation**: 3'e, 6'ya, 10'a.
- Exceptions (e.g. *Kemal'e*) can be overridden per character or per word.

**English:**
- Pronoun sets chosen by the player (they/she/he/custom).
- a/an handling.
- Plurals through ICU and `Intl.PluralRules`.

**Correctness details:**
- **Casing:** locale-aware casing (i↔İ, ı↔I) for ALL-CAPS shouts and effects.
- **Language tags:** `lang` attributes on every text element.
- **Sorting:** Turkish collation.
- **Search:** folds Turkish characters correctly.

**Hyphenation:**
- Turkish words get long (it builds words from stacked suffixes), so narrow phone screens need hyphenation.
- Browser support for Turkish hyphenation is patchy, so **Hyphenopoly** (tr + en patterns) hyphenates both the DOM and GPU text.

**Fonts:**
- The theme editor warns if a chosen font is missing Turkish glyphs (ç ğ ı İ ö ş ü â î û).
- MSDF atlases always include them.

**Extras:**
- **Studio UI** in both languages.
- **TTS narrator** (optional): Web Speech API voices exist for both tr-TR and en on Android.

---

## 5. Music sources & beat analysis

Spotify and YouTube don't expose their raw audio, so they can't be analysed automatically. Plenty of other sources can be, so the engine treats Spotify and YouTube as optional extras.

### Tier A: full audio, so the beat grid is automatic and sync is sample-accurate

| Source | Notes |
|---|---|
| **Your own files** (mp3/ogg/flac/wav/m4a) | Your library, Bandcamp purchases, anything. Stored in OPFS on each device |
| **Jamendo** | Large Creative Commons catalogue with a free API (client ID). Stream and download URLs in mp3, ogg, or flac. Respect `audiodownload_allowed` |
| **Audius** | Free REST API. Streaming endpoint, usually no key, supports Range requests |
| **Openverse** | Search across Creative Commons audio (Jamendo, Freesound, Wikimedia). Good for finding music *and* SFX |
| **AI-generated music** | **ElevenLabs Music v2** (paid): composition plans with per-section style and tempo set in the prompt. Generate a battle theme at a known BPM, then analyse it like any file |
| **Built-in procedural music** | The engine composes loops itself with Tone.js synths and a pattern sequencer. BPM is exact, and layers switch on bar boundaries |
| **Adaptive stems** | Import a song's stems (drums/bass/melody/pads). Combat intensity adds or removes layers, and sections switch on the bar (the usual game-audio technique) |
| **Live AI music** (experimental) | **Lyria RealTime** (Gemini API): a streaming model with a set BPM (60–200), steered live by prompts. The music could follow the fight. Changing BPM mid-stream is abrupt, so BPM stays fixed per fight and intensity is steered instead |

Some catalogue servers may not send CORS headers. The Vite dev proxy handles that locally, and a tiny Cloudflare Worker does the same once hosted.

### Tier B: calibrated, with no raw audio

| Source | Notes |
|---|---|
| **Spotify** (you have Premium ✓) | **Desktop:** the Web Playback SDK. **Phone:** Spotify Connect remote control (looser sync). Since Feb 2026, Development Mode needs a Premium owner, allows only 5 authorized users, and has fewer endpoints, which is fine for you. BPM comes from **ReccoBeats** (Spotify-style audio features by Spotify ID, no key). Phase comes from a one-time 8-beat tap. The OAuth redirect must be a `127.0.0.1` loopback address (Spotify no longer accepts `localhost`); the Studio shows the exact one to register (ADR 0012) |
| **YouTube** (IFrame API) | BPM lookup by title, then tap calibration. Ads and buffering pause the fight. The player must stay visible |

### Analysis pipeline

Runs in a worker; results are cached per track.

1. Decode the file and compute a mel spectrogram.
2. Run **Beat This!** to get **beats and downbeats**, then fit a tempo map (constant or changing).
3. Run Meyda to get spectral flux (onsets), RMS energy, and chroma (musical **key**).
4. Find song sections from a novelty curve.
5. Optional: **demucs-web** separates stems (a large model, so it's opt-in and cached). This gives drum-only onsets for cleaner charts, plus stem-reactive visuals: text pulses on bass while vocals drive the kinetic lyrics.

Notes:
- **Downbeats** let fights phrase themselves in bars (call and response, section changes on bar 1).
- The **musical key** lets hit SFX and dialogue blips snap to the song's scale, so impacts *harmonize*.
- The Beat This! model is too heavy for the phone, so analysis is prepared on desktop and the result travels with the project (ADR 0014). The same rule covers later heavy work such as glyph atlases.

### Other music features

- **Conductor:** one clock interface over all sources.
  - Exact for files and procedural music.
  - Smoothed and drift-corrected for remote players.
- **Latency calibration:** remembered per device and output, with Bluetooth detection.
- **Stall detection:** pauses fights when playback stalls.
- **Optional synced lyrics** as kinetic typography, via **LRCLIB** (a free time-synced lyrics API). Private builds only, since lyrics are copyrighted.

### Which sources can go in a published novel

Under Creative Commons 4.0, music synced in timed relation with moving images always counts as an *adaptation*. Animated, beat-synced text almost certainly counts, which matters for ND and SA tracks. This table is a practical guide, not legal advice.

| Source | Published novel? |
|---|---|
| Your own music, or music you commissioned | ✅ |
| Built-in procedural music | ✅ It's yours |
| CC0 / CC BY | ✅ BY needs a credit, which the publish check adds automatically |
| CC BY-SA | ⚠️ The synced work may have to be shared under the same licence |
| CC …-NC | ⚠️ Only if the novel is free and non-commercial |
| CC …-ND | ❌ Syncing is an adaptation, which ND forbids |
| AI-generated (ElevenLabs, Lyria) | ⚠️ Check your plan's terms for commercial and redistribution rights |
| Purchased tracks (e.g. Bandcamp) | ❌ A personal-use purchase isn't a licence to redistribute. You'd need the artist's permission |
| Audius | ⚠️ Streamed from Audius with an artist credit. Check the artist's terms |
| Spotify | ❌ Private only (5-user Development Mode, and the developer policy bars syncing with visuals) |
| YouTube | ⚠️ Embeddable, but ads, the visible-player rule, and takedowns make it a poor fit |

**Public fallbacks:** every music slot can hold a *private* track and a *public* replacement, e.g. a Spotify song for your own playthroughs and a CC BY track in published builds. Charts are written in beats, so fights adapt to the replacement's tempo automatically.

---

## 6. Runtime modules

### 6.1 Presenter & kinetic typography

**One markup, two renderers.** Each scene picks one, and settings can force DOM mode for accessibility or low power.

| | DOM renderer | GPU renderer |
|---|---|---|
| Best for | Prose reading | Cinematic scenes and combat |
| Strengths | Perfect typography and shaping, native accessibility, low power use | Per-glyph shaders and material graphs, particles, post-FX |
| Accessibility | Native | A hidden DOM mirror keeps screen readers working |

**Layouts:**
- *Page*: book prose.
- *Box*: bottom dialogue panel.
- *Chat*: messenger.
- *Terminal*.
- *Letter*: handwritten or typed, with redactions.
- *Cinematic*.
- Any custom layout from the screen builder.

**Effects:**
- Typewriter, with a speed curve and pauses at punctuation.
- Fade, blur, scramble, wave, tremble.
- Pulse on the beat, glitch.
- Shatter into particles, gravity drop, burn away, ink bleed, redact.
- Variable-font weight and width animation.
- **Unreliable text**: words that change when a passage is revisited, or as sanity drops.

**Character voices:** synthesized dialogue blips per character (waveform, pitch, variance), optionally pitched to the current song's key.

### 6.2 Render & VFX (typographic by default, never locked to it)

**Layers:**
1. Background material.
2. **Stage**: glyph, icon, and shape actors, plus particles.
3. Reading text.
4. HUD and screens.
5. Post-FX.
6. Transitions.

**Visual building blocks:**
- **Glyph particles:** characters such as `* · + ✦ /` as particles.
- **SDF shapes:** slashes, rings, arcs.
- **Icons as MSDF.**

**Screen effects:**
- Hit-stop, trauma shake, flash.
- Zoom punch, slow motion.
- Chromatic aberration, CRT, grain, colour grading.

**Transitions:** noise dissolve, glyph rain, ink spread.

**Optional media modules:** images, video, and 3D can be added later as modules. Core features never depend on them.

**Safety and performance:**
- A photosensitivity guard caps flashes below 3 per second.
- A *Reduced motion* setting.
- Quality tiers detected automatically, plus a frame-time governor (see §11.1).

### 6.3 Audio

**Mixer:**
- Buses: music, sfx, voice, ambience, ui.
- Ducking, muffle filter, reverb send.
- Stereo panning by stage position.

**Sound sources:**
- **sfxr generator:** SFX stored as tiny presets, so a whole novel can ship with zero audio files.
- **Freesound** samples via Openverse.
- **Procedural ambience:** rain, wind, room tone, crowd.

**Musical SFX:** during beat sections, hits can be **quantized to 16th notes** and **pitched to the song's key**.

### 6.4 Rhythm combat & choreography

**Charts and enemies:**
- Charts are written in beats, e.g. `{ beat, action: tap|hold|parry|dodge|chain, lane?, dir? }`.
- Enemies have **movesets**. Each move is a beat pattern, an input type, a choreography clip, and a damage value.
- The **fight director** picks moves each bar, based on:
  - Song section and energy, phrased by **downbeats**.
  - Difficulty.
  - The enemy's phase and HP.
  - A seed, so fights are reproducible.
- A chorus can trigger the enemy's special phase.

**BPM-adaptive density:**
- With `spb = 60 / bpm`, the director picks the subdivision that keeps notes per second inside the difficulty band (Easy 1–2.5, Normal 2–4, Hard 3–6).
- Telegraphs last at least the minimum reaction time.
- Section changes can switch to half-time or double-time.

**Modes** (both main modes are built in Phase 5):
- **Call & response:** the enemy attacks for 2 bars, then you attack for 2 bars.
- **Free beat:** act any time, with bonuses for landing on the beat.
- **Mixed:** the mode switches on section changes within one fight, e.g. call & response in the verses and free beat in the chorus. The enemy's moveset or the fight's settings decide where.
- **Turn-based fallback.**

**Input:**
- Physical keys (D F J K or arrows) are read by position, so the Turkish **Q and F keyboard layouts** both work.
- Touch zones and swipes.
- Gamepad.
- **Android haptics on the beat.**

**Judging:**
- Windows: Perfect ±35, Great ±70, Good ±110 ms.
- Windows widen with the assist setting and with the stream's sync quality.

**Choreography (no images):**
- The enemy is shown as typography: its name and a cloud of "presence" words, or a glyph composition.
- Telegraphs: glyphs gather and a ring shrinks in time with the beats.
- Strikes: the move name slashes across the screen, SDF slash lines are drawn, and onomatopoeia stamps in on 16th notes.
- Hits: hit-stop, shake, glyph shatter.
- A narration ribbon carries short combat lines in both languages.

**Systems tie-ins:**
- Stats modify timing windows.
- Skills are input sequences.
- Status effects alter the chart.
- **Losing is a story branch.** Practice mode, auto-play, and no-fail are available.

### 6.5 Minigames

**Plugin contract:**

```ts
defineMinigame({ id, params, setup, update, onInput, result })
```

- Minigames are drawn with glyphs, icons, and shapes.
- They return `{ outcome, score, data }` to the story.

**Templates:**
- Lockpick
- Signal hack
- Cipher and anagram (with Turkish-aware letters)
- Typing duel (uses the on-screen keyboard)
- Memory sequence
- QTE
- Dice game
- Card duel
- Slider puzzle
- Stealth timing
- Tension bar
- Rhythm mini
- Investigation board
- Argument duel

**No-code builder (later):** compose minigames from parts and drive them with Rules. Parts: grid, deck, dice, timer, meter, lanes, word input, tokens.

### 6.6 Screens (no-code UI builder)

**Components:** stack, grid, text, bar, icon, list, button, tabs, choice list. Each one is **bound to variables**, and buttons run Action blocks.

**What it builds:** title screens, HUDs, inventory, character sheets, maps, shops, phone UIs, and custom menus. Kits ship default screens that you can restyle or replace.

---

## 7. Genre-agnostic: kits, themes, templates

**Kits are bundles of modules, variables, blocks, screens, and a theme.** Kits can be mixed: a mystery story with rhythm fights is just two kits.

| Kit | Adds |
|---|---|
| Visual novel | Characters, box layout, auto/skip, endings gallery |
| Gamebook | Page layout, dice checks, stats sheet, inventory |
| Text RPG | Stats, levels, items, skills, statuses, quests, shops, loot. Rhythm or turn-based combat |
| Rhythm action | Music library, fights, adaptive music, charts |
| Mystery | Clue journal, evidence board, contradiction and accusation choices |
| Social / romance | Affinity, calendar, gifts, scheduled events |
| Survival / management | Resources, days, random event decks |
| Roguelite | Procedural encounter decks, runs, persistent unlocks |
| Explorer | Location graph (rooms, exits), objects, Look / Take / Use / Talk verbs |
| Chat story | Messenger layout, typing delays, notifications |
| Horror | Sanity, distortion effects, unreliable text |
| Terminal | Terminal layout, command-style choices, hacking minigames |
| Kinetic poetry | Cinematic layout, sequencer-driven, music-synced |

**Themes:**
- A theme is pure data: fonts, colours, spacing, text box and choice styles, transitions, UI sounds.
- Presets: *Paper, Night, Terminal, Noir, Neon, Parchment, Static*.

**New-project wizard:** pick a kit, a theme, and a language → a ready-to-edit starter story in both languages.

---

## 8. The Studio

### 8.1 Shell
**Desktop:**
- Docking panels.
- Command palette (Ctrl/Cmd + K).
- Workspaces: *Write · Logic · Sound · Stage · Data · Play*.
- Split view with a live preview.

**Mobile:**
- One panel at a time.
- A bottom tab bar: *Write · Flow · Play · More*.
- Bottom-sheet inspectors.
- 44 px touch targets, pinch to zoom, long-press menus.

**Everywhere:**
- Undo and redo for everything.
- Autosave, named checkpoints.
- Find usages, safe rename.
- Search and replace across the project.

### 8.2 Editors

| Editor | What it does |
|---|---|
| **Manuscript** | The block writing view (§3.3), with a distraction-free mode in the novel's own font |
| **Flow** | Story map, coverage and problem overlays, *Play from here* |
| **Logic** | Rules (When/If/Do) and routines, edited with sentence blocks |
| **Characters** | Name (EN/TR), colour, voice blips, typographic sigil, expression styles, Turkish suffix overrides |
| **Variables** | Types, scopes, descriptions, usages, test values |
| **Translation** | Side-by-side EN/TR, missing/outdated filters, glossary for consistent terms |
| **Screens** | The no-code UI builder (§6.6) |
| **Theme** | Fonts (with Turkish coverage check), colours, layouts, motion, UI sounds |
| **Music & Charts** | Source browser (files, Jamendo, Audius, Openverse, Spotify, YouTube), Analyze, tap tempo, beat grid, sections, latency test, auto-chart preview with a difficulty slider, lane chart editor |
| **Sequencer** (Premiere-style) | Tracks in seconds or beats, beat-snapped. Text, actor, camera, FX, particle, material-parameter, audio, chart, and action tracks. Trim, razor, ripple, nesting, curve editor, J/K/L shuttle, waveforms |
| **Material graph** (Unreal-style) | Nodes compile to TSL, which becomes WGSL or GLSL. Domains: text, surface, particle, post, background, transition. Inputs include `Beat`, `BarPhase`, `SongEnergy`, `GlyphIndex`. Material functions and instances, per-node previews, tap-to-connect |
| **Data** | Items, skills, enemies, quests, loot tables. Table view on desktop, cards on mobile, live formula fields |
| **Minigames** | Template parameters with a live try-out |
| **Library** | Reusable effects, sequences, materials, enemies, themes, and screens shared across all your projects. Import and export packs |
| **Playtest & Debug** | Play from anywhere with state presets, live variable editing, action log, conductor drift overlay, FPS, bookmarks |

### 8.3 Help for the creator

- **Planning:** an outline board of plot-beat cards linked to passages, a plot timeline, word-count goals.
- **Auto-playtester:**
  - A bot plays thousands of random runs.
  - Reports endings reached, dead ends, softlocks, and variable ranges.
  - Lists never-seen passages.
- **The Sampler:** a bilingual demo novel that shows every feature, with an annotated passage per feature.
- **Inline help:** next to every block, setting, and kit.

---

## 9. More features (brainstorm)

**For the player:**
- Rewind to any earlier choice.
- A route flowchart with visited and locked nodes.
- Backlog with voice replay.
- Skip only text you've already seen (tracked by line ID).
- Auto mode.
- Glossary hover cards and a codex.
- Endings and achievements gallery.
- Favourite quotes.
- Chapter select.
- Reading statistics.

**Accessibility:**
- Font size and spacing.
- Dyslexia-friendly font.
- Reduced motion, high contrast.
- Screen reader support.
- Rhythm assists.
- No-fail.

**The world:**
- A day/night and weather layer (shader + soundscape + text tint), optionally tied to the real clock.
- A gyroscope parallax on text layers (Android).

**Systems:**
- **Persistent meta-state:** the game remembers past endings and unlocks routes in later playthroughs.
- **Seeded randomness**, with an optional anti-save-scum setting.

**Later:**
- **Device sync:** a Yjs CRDT document plus a small sync store on Cloudflare (R2). Stable IDs from day one keep this option open.

---

## 10. Project format, storage, saves

```
my-novel/
  project.json            meta, kits, theme, languages, settings, schemaVersion
  chapters/*.json         passages + blocks (both languages inline per line ID)
  logic/*.json            rules, routines
  variables.json  characters.json
  screens/*.json  themes/*.json
  sequences/*.json  materials/*.json  charts/*.json
  data/*.json             items, skills, enemies, quests, loot
  music/tracks.json       sources + tempo maps + calibration + analysis cache refs
  audio/  fonts/          optional local files
```

**Format:** stable IDs everywhere, references by ID, `schemaVersion` plus migrations.

**Storage:**
- OPFS is the primary store.
- On desktop you can open a real folder (File System Access API).
- Zip import and export.
- `navigator.storage.persist()` is requested to reduce the chance of storage eviction.

**Save compatibility after edits:**
- Saves store passage and block IDs.
- If an ID is gone after an update, the game falls back to the nearest checkpoint.
- Migration hooks handle renamed data.

### 10.1 Publishing a novel

- **Build** produces a player-only bundle (no Studio), one per novel.
- **Publish check** runs before every public build:
  - **Music:** every track's source and licence is checked against the table in §5. Spotify and ND tracks block the build; NC, SA, YouTube, Audius, and AI-generated tracks raise warnings. Public fallbacks are used where they're set.
  - **Credits:** a credits screen is generated from asset metadata: CC BY music, game-icons.net icons, font licence notices, and sound sources.
  - **Content:** missing translations, broken links, and dead ends, from the validator.
  - **Size and speed:** bundle size, and a quick run of the performance budget for the reference phone.
- **Destinations:** itch.io (upload the HTML5 zip), a public Cloudflare Pages project kept separate from your private Studio, or any static host.
- **Private and public builds of the same novel:** the private build can use anything, such as your Spotify songs. The public build swaps in the public fallbacks.

---

## 11. Development setup (this PC + your phone) & hosting later

**Dev server:** Vite is bound to **127.0.0.1 only**, so nothing is exposed to your network.

```bash
pnpm dev
```

**Phone (Android, USB debugging on):** this runs `adb reverse tcp:5173 tcp:5173`, then opens Chrome on the phone at `http://127.0.0.1:5173`.

```bash
pnpm phone
```

What this setup gives you:
- **Secure context:** `127.0.0.1` counts as one, so service workers, PWA install, OPFS, WebGPU, and the Spotify loopback redirect all work over plain HTTP. No certificates needed.
- **Hot reload** reaches the phone over the same tunnel.
- **Debugging:** `chrome://inspect/#devices` on the PC shows the phone's console, network, performance profiler, and a live screencast.
- **Optional automated tests on the real phone** through Playwright's Android support over adb.

**Xiaomi (HyperOS/MIUI) notes:**
- Turn on *Developer options → USB debugging*. For Playwright to send taps, also turn on *USB debugging (Security settings)*. Xiaomi ties that one to a Mi account.
- Test in **Chrome**, not the built-in Mi Browser.
- HyperOS closes background tabs aggressively, for example when you switch to the Spotify app. So the player autosaves at every passage and resumes exactly where it left off after a reload.
- In Phase 0, open `chrome://gpu` on the phone to see whether WebGPU is enabled on the Adreno 610. Chrome turns WebGPU on by default for Qualcomm GPUs on Android 12+. Either way, WebGL2 is the baseline every scene must hit its targets on.

**Version control:**
- `git init` in Phase 0.
- A private GitHub repo as a backup.
- Later, CI deploys from it.

**Hosting later:**
- **Cloudflare Pages:** static hosting, free.
- **Cloudflare Access:** a login wall so only you (and anyone you invite) can open the site.
- **Workers:** CORS proxy for music catalogues, an AI key proxy, and optional sync storage.
- **Spotify:** add the hosted `https://…/callback` as a second redirect URI.
- **Published novels** go to their own public site (§10.1), never behind the Studio's login.

### 11.1 Performance budget: Redmi Note 12 4G

The Adreno 610 is an entry-level GPU, so the phone is the reference device from Phase 0 on. A feature isn't done until it meets these targets on the phone:

| Budget | Target |
|---|---|
| Frame rate | Steady **60 fps**. The 120 Hz screen is used for UI scrolling and reading; heavy scenes render every other refresh |
| Frame time | JavaScript < 6 ms and GPU < 10 ms per frame |
| Stage resolution | ~1.5× instead of the screen's full ~2.6×, adjusted dynamically. MSDF text stays sharp at any scale, and DOM text is always native resolution |
| Post-FX | Half resolution, at most 2 passes on the phone tier |
| Particles | ≤ 3,000 instanced glyphs |
| Draw calls | < 100 per frame (instancing everywhere) |
| Memory | < 400 MB for the tab |
| Startup | Reader shell < 250 KB gzipped. The GPU stage is created only when a scene first uses it |
| Beat analysis | Small Beat This! model, about a minute or less for a 4-minute song, once per track (cached). Stem separation is desktop-only |
| Battery & heat | Render on demand while reading. A governor drops a quality tier when frame times run long for 5 s, because the Snapdragon 685 throttles under sustained load |
| Audio latency | Calibrated per output. Android Chrome adds more output latency than desktop, and Bluetooth adds much more |
| Haptics | Short 10–20 ms pulses, since the phone's vibration motor is basic |

A built-in performance HUD shows these numbers live. `chrome://inspect` profiles the phone from the PC.

**Measured on the phone (Phase 0, 2026-11-09, Chrome 156, Android 13):**

| What | Result | What it means |
|---|---|---|
| WebGPU | On by default (adapter `qualcomm · adreno-6xx`) | The WebGPU path can be the phone's first choice; WebGL2 stays the fallback |
| WebGL2 | ANGLE on Adreno 610, OpenGL ES 3.2, max texture **4096 px** | Glyph atlases and render targets must fit in 4096 px |
| Refresh rate | **60 Hz in a Chrome tab**, although the system is set to 120 Hz | HyperOS caps the browser. The 60 fps target stands; re-measure in the installed app |
| Viewport | 392 × 713 CSS px in a tab (screen 393 × 873), DPR 2.75 | Browser chrome takes ~160 px; the installed app gets the full height |
| Audio | 48 kHz, 3 ms base latency (output latency not reported) | Calibration has to measure output latency itself |
| Memory | `navigator.deviceMemory` reports 4 GB (the API rounds down) | Don't use it to pick quality tiers on this phone |
| Offline | Both apps load fully from the service worker with no route to the PC, in a tab and installed | The Phase 0 done condition holds |
| Install | Installed as standalone apps (392 × 790 viewport) but not as WebAPKs, because the phone had no internet | Re-check on the hosted site; the refresh rate inside the installed app is still unmeasured |

**Measured on the phone (Phases 3 and 4, 2026-11-10, Chrome 156, in a tab):**

| What | Result | What it means |
|---|---|---|
| Stage, reading | Rain background: 59.5 fps, 0 long tasks | Ambient scenes stay inside the budget |
| Stage, cinematic | Title + burst + shake + flash + ink transition over the film look: 59.6–59.9 fps on every tier, 2 draw calls, ~0.3–0.4 ms stage JavaScript a frame, at most 1 frame over 20 ms in 5 s | The Phase 4 done condition holds on the WebGL2 path |
| Fight scene | Shake, flash, sparks and freeze in The Rain Alley through real touch input: 59.5 fps, 0 long tasks, 20 MB heap | Effects inside a story cost nothing visible |
| Beat analysis (built-in tracker) | 16 s clip in 1.1 s; a 4-minute track in 9.3 s; correct 100 BPM 4/4 | Phones analyse well within budget without Beat This! |
| Audio output | Chrome holds an AAudio media stream with audio focus while music plays | Sound reaches the speaker path; loudness and latency need a person listening |

---

## 12. Building it with AI

**Repo guidance:**
- **`CLAUDE.md`:** an architecture map plus hard rules:
  - Packages talk only through public `index.ts` APIs and the kernel.
  - All data goes through Zod schemas.
  - Logic needs unit tests.
  - No file over ~400 lines.
- **`docs/adr/`:** one short decision record per architectural choice, so future sessions don't re-argue settled decisions.

**Small tasks:**
- Each roadmap phase is broken into 10–20 tasks.
- Each task has acceptance checks and fits one session.
- One commit per task.

**Guardrails on every change:**
- Strict TypeScript, ESLint, and Vitest.
- Playwright smoke tests at phone and desktop sizes.
- The **Sampler** novel must keep playing.

**Schemas protect your content too:** everything you create in the Studio is validated against the same schemas. A bad edit or an engine update can't silently corrupt a project, and migrations upgrade old projects automatically.

---

## 13. Roadmap

Every phase ends with something you can use. Sizes are relative (S < M < L < XL).

| # | Phase | Size | Done when… |
|---|---|---|---|
| 0 | **Foundation**: git, monorepo, kernel, action/event bus, state, storage, i18n core, PWA shells, design tokens, `CLAUDE.md`, `pnpm phone`, phone GPU check, performance HUD | M | The empty Player and Studio install offline on your phone over adb |
| 1 | **Story runtime & reader**: story model and interpreter, variables, choices (all types), DOM presenter, layouts, markup effects v1, saves/rewind/backlog, EN/TR with Turkish suffixes and hyphenation, Paper and Night themes | L | A JSON-authored bilingual branching story plays on your phone and switches language mid-scene |
| 2 | **Writing studio**: Manuscript, Flow, condition builder, action blocks, characters, variables, translation view, validation, Play from here | L | ⭐ **Milestone A:** you write a bilingual branching novel on phone or desktop **without code** |
| 3 | **Audio & music**: mixer, sfxr, blips, ambience; sources (files, Jamendo, Audius, Openverse, Spotify, YouTube); analysis worker (Beat This!, Meyda); conductor; calibration | L | Any file or catalogue song gets beats and downbeats automatically. Spotify and YouTube stay in sync after a tap |
| 4 | **Stage & VFX**: WebGL2 stage (ADR 0015), SDF glyph renderer, GPU titles, particles, screen FX, looks, transitions, quality tiers, stage blocks and the Stage view | L | A cinematic scene holds 60 fps on the Redmi Note 12 within the §11.1 budget |
| 5 | **Rhythm combat**: charts, judge, director, BPM-adaptive density, **both modes (call & response, free beat, mixed)**, choreography, HUD, adaptive stems and procedural music, results to the story | XL | ⭐ **Milestone B:** a conversation, then a choice, then a fight on your song, then a branch on the result |
| 6 | **Logic & kits I**: Rules, Routines, formulas; RPG kit (stats, inventory, checks, quests, shops); turn-based combat; Data editor | L | An RPG chapter is built entirely in the Studio |
| 7 | **Screens & themes**: screen builder, theme editor, kit system, new-project wizard, starter kits (VN, Gamebook, Chat, Mystery) | L | You can start a project in a different genre in a few clicks |
| 8 | **Sequencer** | XL | Fight moves and cinematic scenes are authored on a beat-snapped timeline |
| 9 | **Material graph** | XL | Text and post effects are built from nodes and animated by the sequencer |
| 10 | **Minigames**: framework + 8 templates; Library and packs | M | Minigames launched from the story feed their results back |
| 11 | **Polish & publish**: auto-playtester, accessibility pass, publish check + auto credits, public fallbacks, public builds (itch.io / Cloudflare Pages), private Studio on Cloudflare Pages + Access, performance pass | L | A finished novel is live at a public URL, and the Studio runs from your private one |
| — | **Later**: Script view, device sync, live AI music (Lyria), stem separation, remaining kits, minigame builder, optional media modules, ink/Twine import | — | — |

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Scope is very large | Two early milestones (A: no-code writing, B: rhythm fight). Every phase is usable. Modules can be skipped |
| Block editor and the Android keyboard (Gboard, Turkish input) | A spike test early in Phase 2. ProseMirror's mobile handling is tested before we commit |
| Beat This! model size and speed on the phone | Use the small model where available, cache it in OPFS, fall back to WASM, and analyse on desktop when needed |
| Entry-level phone GPU (Adreno 610) | WebGL2 baseline, lower stage resolution, half-res post-FX, a frame-time governor, and the phone as the reference device from Phase 0 |
| HyperOS closing the tab | Autosave at every passage, exact resume after a reload |
| Music rights in published novels | Publish check, per-track public fallbacks, auto-generated credits |
| Catalogue CORS | Vite dev proxy locally, a Cloudflare Worker when hosted |
| Spotify rules keep tightening | Spotify is an optional adapter. You meet today's requirements (Premium owner, ≤5 users) |
| Turkish morphology exceptions | Per-word and per-character overrides, plus a growing exception list |
| GPU text shaping | The DOM renderer handles prose. GPU text targets Latin scripts, which covers both English and Turkish |
| iOS (if ever needed) | Only Android is the dev target. iOS works through WebGL2 fallbacks and has no vibration |
| AI-written code drifting | `CLAUDE.md` rules, ADRs, schemas, tests, small tasks, and the Sampler as a regression test |

---

## 15. Open questions

None right now. Answered so far:
- Both fight modes.
- Some novels may be published.
- No AI writing assistant.
- The Redmi Note 12 4G is the reference phone.

All of these are recorded in §0.

---

## Sources

- [Spotify Feb 2026 Dev Mode migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) · [Spotify developer blog, Feb 2026](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security) · [TechCrunch on the changes](https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/embed/)
- [Spotify redirect URI rules (loopback 127.0.0.1)](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri) · [Spotify OAuth migration, Nov 2025](https://developer.spotify.com/blog/2025-10-14-reminder-oauth-migration-27-nov-2025)
- [Jamendo API tracks](https://developer.jamendo.com/v3.0/tracks) · [Audius stream endpoint](https://docs.audius.org/developers/api/stream-track) · [Openverse audio API](https://apis.io/apis/openverse/openverse-audio-api/)
- [ReccoBeats audio features](https://reccobeats.com/docs/documentation/Analysis/audio-features-extraction)
- [Beat This! ONNX for the browser](https://huggingface.co/musetric/beat-this-onnx) · [Beat This! paper (ISMIR 2024)](https://arxiv.org/html/2407.21658v1)
- [demucs-web (stems in the browser)](https://github.com/timcsy/demucs-web)
- [ElevenLabs Music v2 changelog](https://elevenlabs.io/docs/changelog/2026/6/15) · [Lyria RealTime docs](https://ai.google.dev/gemini-api/docs/realtime-music-generation?hl=en)
- [Yarn Spinner in 2026](https://www.yarnspinner.dev/2026) · [GDevelop events (event-sheet model)](https://wiki.gdevelop.io/gdevelop5/events/)
- [Turkish hyphenation support (caniuse)](https://caniuse.com/mdn-css_properties_hyphens_language_turkish)
- [Strudel FAQ (AGPL, why it isn't used)](https://strudel.cc/learn/faq/)
- [CC BY-ND 4.0 legal code (syncing music to moving images counts as an adaptation)](https://creativecommons.org/licenses/by-nd/4.0/legalcode)
- [Redmi Note 12 4G specs (GSMArena)](https://m.gsmarena.com/xiaomi_redmi_note_12_4g-12188.php) · [Beebom specs (sensors)](https://gadgets.beebom.com/mobile/redmi-note-12-4g?view=specs)
- [WebGPU on Android (Chrome 121)](https://developer.chrome.com/blog/new-in-webgpu-121?authuser=0) · [WebGPU compatibility mode (Chrome 146)](https://developer.chrome.com/blog/new-in-webgpu-146?hl=en)
