# 0008 — Reader presentation: beats to DOM, typing, effects, hyphenation

**Status:** accepted · 2026-11-09

## Context

The story runtime (ADR 0007) produces beats: block IDs plus captured values, never rendered text.
Phase 1 needs a DOM reader that draws them in three layouts, types lines in, plays markup effects,
switches language mid-scene, and stays inside the Redmi Note 12's budget (ADR 0006, PLAN §11.1).
The Studio's Play view will need the same drawing later.

## Decision

**A framework-free presenter package.** `@ie/present` draws a running `StoryRuntime` into DOM.
It decides nothing: it shows what the runtime produced and reports what the reader did
(`choose`, `submit`, `advance`, `restart`) to a host, which routes it through the action bus. The
Player owns taps, keys, menus and storage; the Studio's Play view can host the same presenter.

**Redraw from the log.** `show(beats)` types the newest line; `redraw()` rebuilds the current page
from `runtime.page()` at once. A language switch, a rewind, a load and a reload are all redraws, so
there is one way to put a page on screen. A redraw of the same waiting beat keeps its running timer.

**Typing never re-wraps.** Untyped text sits in a `visibility: hidden` span after the typed part,
so lines keep their final shape while they type. A tick costs at most two text-node writes. The
typewriter itself is DOM-free (steps with `reveal` callbacks) and unit-tested with a fake clock.
It pauses after sentence and clause stops, honours `[pause]` and `[speed]`, and reveals several
characters per tick when faster than a frame. The reading speed is a per-device setting.

**Effects are CSS on spans.** `b`, `i`, `whisper`, `shout`, `color` style a span. `shake`,
`tremble` and `wave` put each letter in its own box (words stay unbreakable) and animate
`translate`, which the compositor handles. `fade` and `scramble` reveal a run whole. Only the newest
line keeps moving: older lines drop their animations, which bounds per-frame work to one line.
Colours a story may name (`accent`, `muted`, `faint`, `ink`) map to theme tokens in CSS.
Reduced motion stills every effect; the choice timer stays, in one-second steps, because it
carries information.

**Layouts.** `page` (book prose, keep-page passages continue it), `box` (one line at a time in a
bottom panel, choices above it) and `chat` (bubbles; the `player` character's lines on the right;
others arrive whole after a typing indicator). A run of lines from one speaker names them once.

**Choices explain themselves.** Locked options stay focusable (`aria-disabled`) and say why, from
the runtime's lock: the author's own text, else a generated "Requires Charisma 6" /
"Karizma 6 gerekli". Odds show as a whole percentage, never 0 % or 100 % for a real gamble.
Timed choices pause while the menu, a sheet, or another app covers the page, and can be turned off.

**Accessibility.** Each line carries its words once, whole, in a screen-reader-only span; the
typed copy is `aria-hidden`. Speakers are read as "Mira: …". Every text element has a `lang`.

**Hyphenation by soft hyphens, from Hyphenopoly.** Browser hyphenation is unreliable for Turkish,
so the presenter inserts U+00AD itself (`hyphens: manual`), using Hyphenopoly's module API with our
own `fetch` loader (`loadHyphenators()` in `@ie/i18n`). Patterns are about 24 kB of WASM and are
precached by the PWA. We compared the `hyphen` package: same TeX patterns, but CommonJS and about
110 kB for the two languages. Per-letter effect runs aren't hyphenated (their boxes can't break);
they're short phrases. The Player waits up to 0.5 s for the patterns before the first page, then
redraws when they arrive.

## Consequences

- Any new layout is CSS plus, at most, a different reveal (as Chat does); the beat model stays.
- New effects must stay compositor-friendly and settle when their line is no longer newest, or be
  measured on the phone first.
- A GPU presenter (PLAN §6.1) can reuse the same beats, typewriter steps and labels.
- Hyphenation patterns load once for both languages; adding a language adds its `.wasm`.
