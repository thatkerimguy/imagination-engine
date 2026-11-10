# 0018 — Story themes, screens, and kits

**Status:** accepted · 2026-11-10

## Context

Phase 7 (PLAN §6.6, §7, §13) makes the engine genre-agnostic in practice: a story gets its own
look, its own screens (title, HUD, panels), and a new project can start from a genre kit in a few
clicks. The owner builds all of it in the Studio, without code (CLAUDE.md). The Player stays
framework-free, and the reading page has to stay inside the Redmi Note 12 budget (ADR 0006).

## Decision

**A theme is data on the project.** `project.theme` holds a preset plus optional overrides:
six colours (background, surface, ink, muted, accent, line) as `#rrggbb`, a prose and a UI font
family, a text size and line height, a choice style (`outline`, `filled`, `underline`, `plain`)
and a page transition (`none`, `fade`, `rise`). The presets are _Auto, Paper, Night, Terminal,
Noir, Neon, Parchment, Static_. **Auto** sets no colours, so the page follows the reader's own
Paper/Night setting, as every story did before. `@ie/present` resolves a theme into the same CSS
variables the design tokens define (`--color-ink`, `--font-prose`, …) and sets them on the element
that holds the story. Every existing rule then picks the theme up with no new per-frame work.
Derived tokens (faint ink, lines, selection, accent ink, `color-scheme`) are computed from the six
colours, so a theme can't leave one half-styled.

**Fonts are the three bundled families only** (Literata, Inter, JetBrains Mono, named _serif_,
_sans_ and _mono_). They are self-hosted, cached offline, and cover Turkish (ç ğ ı İ ö ş ü â î û),
so the Turkish-glyph warning PLAN §4 asks for can't fire yet. Custom fonts come with the Library,
and the check comes with them. The theme editor does warn when ink or muted text falls below WCAG
contrast (4.5:1 and 3:1) against the background.

**The reader can opt out.** The Player gains "Use the story's look" (on by default). Off, the page
uses the reader's Paper/Night, which is an accessibility setting, like turning timers off.

**Screens are a component tree on the project.** `project.screens` holds screens of three kinds:
_title_ (shown before the story starts), _HUD_ (a strip above or below the page, always visible
while reading) and _panel_ (a sheet opened from the menu or a button). Components are `stack`,
`grid`, `text`, `bar`, `icon`, `list`, `button` and `tabs`. Text interpolates variables like story
lines. Bars and lists are bound to variables, the inventory, quests or the stat variables. Any
component can carry a visibility formula. Buttons run **screen actions**: start, continue, open a
screen, close it, open a Player panel (settings, saves, history, character sheet), and set a
variable. That last one uses the set block's operations, so a screen can't do anything a set block
can't. Rules it triggers run at the next step, like any change made between steps.

The PLAN's _choice list_ component is left out: it only matters for custom reading layouts, which
come with the sequencer. Running whole routines from a button is left out too, because routines
can wait and jump, and a button press between steps can't.

**One DOM renderer, two hosts.** `@ie/present` turns screens into a plain view model
(`screenModel`), renders it (`renderNodes`) and owns a `ScreenHost` that puts the title overlay,
the HUD and panels around a presenter. The Player and the Studio's Play view both use it, and the
Studio's screen editor previews with the same host against a fresh runtime. The preview compiles
the story with `compileStory(doc, { allowErrors: true })`, so it keeps up while a screen is half
built; a story compiled that way is never played. The host refreshes after each step and on a
language switch, never per frame, and rebuilds an element only when its view model changed: an
unchanged rebuild would cost a layout, and one under the reader's finger swallows the tap.

**Icons are a small built-in set** of inline SVG paths in `@ie/present` (heart, coin, star, key,
clock, book, search, message, map, bolt). The Player has no icon library, and a closed set keeps
screens valid data.

**Kits are data packages in `@ie/kits`.** A kit is a JSON bundle checked by a Zod schema: a theme
preset, a layout, variables, characters, items, quests, rules, screens, and a short bilingual
starter story. `createFromKit` builds a new project from a kit, a theme and the languages, with a
fresh project ID. `applyKit` merges a kit's definitions into an existing project. Kits mix that
way: anything whose ID already exists is kept, and the kit's story is never merged. The project
records its kits in `project.kits`. The first kits are _Visual novel_, _Gamebook_, _Chat story_
and _Mystery_, plus _Blank_. Each one's starter story is tested to validate, compile, pass analysis
and play to an ending.

**The new-project wizard** replaces the single "New novel" button: pick a kit, then a theme
(the kit suggests one), then the languages and title. Then Create. Every step has a default, so a
kit is three clicks after choosing it.

**The Player plays kits only in development.** Until the Studio publishes stories, the Player
bundles one sample. `?kit=<id>` plays a kit's starter story in dev builds, so screens and looks can
be tried and tested end to end there; production builds drop the kits entirely.

## Consequences

- A theme or screen never needs code, and an old project without either looks exactly as before.
- New presets and kits are data plus tests. A new component type touches the schema, the
  renderer, the Studio's component editor and analysis.
- Screens that affect the story only do so through variables, so saves, rewind and determinism
  (ADR 0009) are unchanged: a set made from a screen is part of the next saved state.
- UI sounds in themes and the remaining kits are later work.
