# 0014 — Prepare on desktop, play anywhere

**Status:** accepted · 2026-11-10

## Context

The reference phone (ADR 0006, PLAN.md §11.1) is an entry-level device: an Adreno 610, 4 GB of
memory, a CPU that throttles under load. Some work a novel needs is heavy but has the same result
every time it runs on the same input. Beat This! is the first example: about 190 MB of model and
seconds of GPU time per song. Phase 4 adds more of the same kind: MSDF glyph atlases, particle
sprite sheets, blurred or lit textures, and shader warm-up data.

The owner writes on a desktop as well as on the phone, and readers may have phones weaker still.

## Decision

**Heavy, deterministic work is done in the Studio, ideally on a desktop, and its result is saved
with the novel.** The Player only reads results; it never runs that work.

- **What qualifies:** derived data that depends only on content the author controls, and that is
  costly in time, memory or download size. Beat grids, key and sections (now); glyph atlases and
  baked effect textures (Phase 4); anything later that fits the same description.
- **Where results live:** in the project document when they are small and part of the story's
  meaning (a track's `analysis`), or as generated assets beside it when they are large (atlases).
  Each result records what produced it (`tracker: 'beat-this-1'`; a generator version for assets),
  so a better generator knows what to redo.
- **The Studio prepares, on request and on its own:** new songs are analysed with the best tracker
  the device has. Sound → Setup lists songs whose beats could be better and analyses them all in
  one go. A publish check (Phase 11) will refuse a public build that still needs preparing.
- **Phones fall back, never fail:** the Studio on a phone uses whatever the novel already holds. It
  uses the light built-in path (the DSP tracker) only for something not prepared yet, and the
  desktop's result replaces it later.
- **Heavy models are opt-in downloads.** They are fetched only when the author asks, from a pinned
  revision checked by SHA-256, and kept in OPFS. They are never part of the app bundle or the
  service worker's install.

## Consequences

- A low-end phone plays a prepared novel with no model, no analysis and no atlas generation, which
  keeps startup and memory inside the §11.1 budget.
- Preparing is a step the author has to think about. The Studio shows it (the count in Sound →
  Setup today; the publish check later) rather than doing it silently on a phone.
- Results are only as good as the device that made them. A song analysed on the phone with the DSP
  tracker keeps that grid until a desktop prepares it again.
